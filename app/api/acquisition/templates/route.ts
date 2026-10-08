import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getOpenCycle } from "@/lib/cycle";
import { createAiJob } from "@/lib/ai-jobs";
import { brainSummary } from "@/lib/brain";
import { deterministicCycleTemplate } from "@/lib/acquisition";

export const dynamic = "force-dynamic";

const ManualTemplateSchema = z.object({
  cycleId: z.string().min(1).max(100),
  generate: z.literal(false).optional(),
  subject: z.string().trim().min(3).max(200),
  opening: z.string().trim().max(500).nullish(),
  body: z.string().trim().min(20).max(6000),
  cta: z.string().trim().max(300).nullish(),
});
const GenerateTemplateSchema = z.object({
  cycleId: z.string().min(1).max(100),
  generate: z.literal(true),
});
const TemplatePostSchema = z.union([ManualTemplateSchema, GenerateTemplateSchema]);

/**
 * GET /api/acquisition/templates?cycleId= — versions newest-first + the
 * approved one (history is never rewritten).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const cycleId = new URL(req.url).searchParams.get("cycleId") ?? "";
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId };
      if (cycleId) where.cycleId = cycleId;
      const templates = await tx.messageTemplate.findMany({ where, orderBy: { version: "desc" }, take: 50 });
      return { templates, approved: templates.find((t: any) => t.status === "approved") ?? null };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not list templates." }, { status: 500 });
  }
}

/**
 * POST /api/acquisition/templates — new version on an OPEN cycle.
 * Manual: validated copy, source manual. Generate: deterministic version saved
 * immediately (Step 3 never blocks on AI) + an EMAIL_GENERATION job whose
 * validated result becomes an additional AI version on completion.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "cycle");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = TemplatePostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid template" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const cycle = await getOpenCycle(tx, tenantId, parsed.data.cycleId);
      if (!cycle) return { error: "Cycle not found or already closed", status: 404 };
      const agg = await tx.messageTemplate.aggregate({ where: { tenantId, cycleId: cycle.id }, _max: { version: true } });
      const version = ((agg._max?.version as number | null) ?? 0) + 1;
      let template: any;
      if (parsed.data.generate) {
        const brain = await tx.companyBrain.findUnique({ where: { tenantId } });
        const companyName = (brain?.payload as any)?.company?.name ?? "our company";
        const det = deterministicCycleTemplate(companyName);
        template = await tx.messageTemplate.create({
          data: { tenantId, cycleId: cycle.id, version, ...det, status: "draft", source: "deterministic" },
        });
      } else {
        template = await tx.messageTemplate.create({
          data: {
            tenantId, cycleId: cycle.id, version,
            subject: parsed.data.subject, opening: parsed.data.opening ?? null,
            body: parsed.data.body, cta: parsed.data.cta ?? null,
            status: "draft", source: "manual",
          },
        });
      }
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.template.create", model: "MessageTemplate", recordId: template.id, after: { version, source: template.source } },
      }).catch(() => null);
      return { template };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });

    // AI variants are additive: the deterministic/manual version above is
    // already usable; the job adds an `ai` version on validated completion.
    let generationJob: any = null;
    if ((body as any).generate) {
      const goal = await withTenantContext(tenantId, async (tx: any) =>
        tx.cycleGoal.findFirst({ where: { cycleId: (result as any).template.cycleId, tenantId }, orderBy: { createdAt: "asc" } }),
      );
      const brain = await withTenantContext(tenantId, async (tx: any) => tx.companyBrain.findUnique({ where: { tenantId } }));
      const created: any = await createAiJob({
        tenantId, cycleId: (result as any).template.cycleId, operation: "EMAIL_GENERATION",
        inputRef: {
          cycleId: (result as any).template.cycleId,
          goal: goal ? { title: goal.title, audience: goal.audience, outcome: goal.outcome, angle: goal.angle } : null,
          brainSummary: brain ? brainSummary(brain.payload as any) : "",
        },
        idempotencyParts: ["email-gen", (result as any).template.cycleId, String((result as any).template.version)],
      });
      generationJob = created.job;
    }
    return NextResponse.json({ ...(result as any), generationJob }, { status: 201 });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    console.error("[templates] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal", detail: "Could not save template." }, { status: 500 });
  }
}
