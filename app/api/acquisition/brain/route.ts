import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { brainFromIntake, brainFromMarkdown, mergeBrains, CanonicalBrainSchema } from "@/lib/brain";
import { createAiJob } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

const FromIntakeSchema = z.object({ action: z.literal("from-intake"), aiEnrich: z.boolean().optional() });
const FromMarkdownSchema = z.object({
  action: z.literal("from-markdown"),
  markdown: z.string().min(20).max(60_000),
  aiEnrich: z.boolean().optional(),
});
const BrainPostSchema = z.union([FromIntakeSchema, FromMarkdownSchema]);

/**
 * GET /api/acquisition/brain — persistent Company Brain (or null + intake
 * presence flag so the UI can offer the right entry path).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const brain = await tx.companyBrain.findUnique({ where: { tenantId } });
      const profile = await tx.acquisitionProfile.findUnique({ where: { tenantId } });
      const integration = await tx.integrationStatus.findUnique({
        where: { tenantId_key: { tenantId, key: "obsidian" } },
      }).catch(() => null);
      return {
        brain,
        hasIntakeProfile: !!profile,
        obsidian: integration ? { state: integration.state, detail: integration.detail, lastOkAt: integration.lastOkAt } : { state: "disconnected" },
      };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load Company Brain." }, { status: 500 });
  }
}

/**
 * POST /api/acquisition/brain — build/refresh the canonical brain.
 * from-intake: deterministic mapping of the existing AcquisitionProfile.
 * from-markdown: deterministic parse of pasted/uploaded vault markdown.
 * Both produce the SAME canonical shape. aiEnrich queues an optional
 * BRAIN_ANALYSIS job; the deterministic result is saved immediately either
 * way, so the brain never depends on AI availability.
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
    const parsed = BrainPostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid brain request" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const existing = await tx.companyBrain.findUnique({ where: { tenantId } });
      let incoming;
      let source: string;
      if (parsed.data.action === "from-intake") {
        const profile = await tx.acquisitionProfile.findUnique({ where: { tenantId } });
        if (!profile) return { error: "No intake profile yet — complete intake first.", status: 409 };
        incoming = brainFromIntake(profile);
        source = "intake";
      } else {
        incoming = brainFromMarkdown(parsed.data.markdown);
        if (!incoming.company.name) return { error: "Could not identify a company name in that markdown.", status: 422 };
        source = "obsidian";
      }
      const base = existing ? CanonicalBrainSchema.parse(existing.payload) : null;
      const merged = base ? mergeBrains(base, incoming) : incoming;
      if (!merged.company.name.trim()) {
        return { error: "Company name is required — the import did not identify one.", status: 422 };
      }
      let brain;
      if (existing) {
        await tx.companyBrainRevision.create({
          data: { tenantId, brainId: existing.id, version: existing.version, source: existing.source, payload: existing.payload },
        });
        brain = await tx.companyBrain.update({
          where: { tenantId },
          data: { payload: merged, version: { increment: 1 }, source: existing.source === source ? source : "merged", status: "active" },
        });
      } else {
        brain = await tx.companyBrain.create({
          data: { tenantId, source, version: 1, status: "active", payload: merged },
        });
      }
      if (source === "obsidian") {
        await tx.integrationStatus.upsert({
          where: { tenantId_key: { tenantId, key: "obsidian" } },
          create: { tenantId, key: "obsidian", state: "connected", detail: "markdown import", lastOkAt: new Date() },
          update: { state: "connected", detail: "markdown import", lastOkAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.brain.save", model: "CompanyBrain", recordId: brain.id, after: { source, version: brain.version } },
      }).catch(() => null);
      return { brain };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });

    // Optional AI enrichment never blocks the deterministic save above.
    let enrichJob: any = null;
    if ((parsed.data as any).aiEnrich) {
      const created: any = await createAiJob({
        tenantId, operation: "BRAIN_ANALYSIS",
        inputRef: { expectedVersion: (result as any).brain.version, markdown: parsed.data.action === "from-markdown" ? (parsed.data as any).markdown.slice(0, 12000) : undefined },
        idempotencyParts: ["brain", String((result as any).brain.version)],
      });
      enrichJob = created.job;
    }
    return NextResponse.json({ ...(result as any), enrichJob });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    console.error("[brain] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal", detail: "Could not save Company Brain." }, { status: 500 });
  }
}
