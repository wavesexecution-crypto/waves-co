import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { allocateCycleNumber, CycleGoalSchema, formatCycleNumber } from "@/lib/cycle";
import { createAiJob } from "@/lib/ai-jobs";
import { onCycleStarted } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const NewGoalBody = z.object({
  mode: z.literal("new"),
  goal: CycleGoalSchema,
  analyze: z.boolean().optional(),
});
const CloneGoalBody = z.object({
  mode: z.literal("clone"),
  fromGoalId: z.string().min(1).max(100),
  analyze: z.boolean().optional(),
});
const CyclePostSchema = z.union([NewGoalBody, CloneGoalBody]);

/**
 * GET /api/acquisition/cycles — tenant's cycles newest-first with goal +
 * template/report presence flags for the stepper UI.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const cycles = await tx.acquisitionCycle.findMany({
        where: { tenantId },
        orderBy: { cycleNumber: "desc" },
        take: 50,
        include: {
          goals: { select: { id: true, title: true, source: true, status: true } },
          templates: { select: { id: true, version: true, status: true }, orderBy: { version: "desc" }, take: 1 },
          cycleReport: { select: { id: true, status: true, createdAt: true } },
        },
      });
      return {
        cycles: cycles.map((c: any) => ({
          ...c,
          label: formatCycleNumber(c.cycleNumber),
          goal: c.goals?.[0] ?? null,
          latestTemplate: c.templates?.[0] ?? null,
        })),
      };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not list cycles." }, { status: 500 });
  }
}

/**
 * POST /api/acquisition/cycles — start a new cycle (STEP 2).
 * Every cycle gets its OWN goal row: either validated fresh input (mode new)
 * or a safe clone of a previous goal (mode clone — history never mutated).
 * Returns the cycle + goal; optionally queues GOAL_ANALYSIS (advisory).
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
    const parsed = CyclePostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid cycle request" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const { id: cycleId, cycleNumber } = await allocateCycleNumber(tx, tenantId);
      let goal: any;
      if (parsed.data.mode === "new") {
        goal = await tx.cycleGoal.create({
          data: { tenantId, cycleId, ...parsed.data.goal, status: "active", source: "new" },
        });
      } else {
        const source = await tx.cycleGoal.findFirst({ where: { id: parsed.data.fromGoalId, tenantId } });
        if (!source) {
          // Roll back the just-allocated empty cycle so failed clones leave
          // no orphan rows.
          await tx.acquisitionCycle.delete({ where: { id: cycleId } }).catch(() => null);
          return { error: "Source goal not found", status: 404 };
        }
        const { id: _drop, cycleId: _c, createdAt: _a, updatedAt: _b, ...fields } = source;
        goal = await tx.cycleGoal.create({
          data: { ...fields, tenantId, cycleId, status: "active", source: "clone", sourceGoalId: source.id },
        });
      }
      await tx.acquisitionCycle.update({ where: { id: cycleId }, data: { goalId: goal.id } });
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.cycle.start", model: "AcquisitionCycle", recordId: cycleId, after: { cycleNumber, mode: parsed.data.mode } },
      }).catch(() => null);
      const cycle = await tx.acquisitionCycle.findUnique({ where: { id: cycleId } });
      return { cycle: { ...cycle, label: formatCycleNumber(cycleNumber) }, goal };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    onCycleStarted(tenantId, (result as any).cycle.id, userId);

    let analysisJob: any = null;
    if (body.analyze) {
      const created: any = await createAiJob({
        tenantId, cycleId: (result as any).cycle.id, operation: "GOAL_ANALYSIS",
        inputRef: { cycleId: (result as any).cycle.id, goalId: (result as any).goal.id, goal: (result as any).goal },
        idempotencyParts: ["goal-analysis", (result as any).goal.id],
      });
      analysisJob = created.job;
    }
    return NextResponse.json({ ...(result as any), analysisJob }, { status: 201 });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    console.error("[cycles] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal", detail: "Could not start cycle." }, { status: 500 });
  }
}
