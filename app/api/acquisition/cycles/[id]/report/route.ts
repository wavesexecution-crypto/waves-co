import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { formatCycleNumber } from "@/lib/cycle";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/cycles/[id]/report — the immutable cycle report.
 * Metrics are always present (deterministic). The AI narrative is present
 * once its job validates; otherwise the response honestly reports
 * `narrative: null` + the job state so the UI shows "analysis pending"
 * instead of inventing conclusions.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const { id } = await params;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const cycle = await tx.acquisitionCycle.findFirst({
        where: { id, tenantId },
        include: {
          goals: { orderBy: { createdAt: "asc" }, take: 1 },
          cycleReport: true,
        },
      });
      if (!cycle) return null;
      let narrativeJob: any = null;
      if (cycle.cycleReport && !cycle.cycleReport.narrative) {
        narrativeJob = await tx.aiJob.findFirst({
          where: { tenantId, operation: "CYCLE_ANALYSIS", cycleId: cycle.id },
          orderBy: { updatedAt: "desc" },
          select: { id: true, status: true, attempt: true, error: true, updatedAt: true },
        });
      }
      return {
        cycle: { ...cycle, label: formatCycleNumber(cycle.cycleNumber) },
        report: cycle.cycleReport,
        narrativeJob,
      };
    });
    if (!result) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load report." }, { status: 500 });
  }
}
