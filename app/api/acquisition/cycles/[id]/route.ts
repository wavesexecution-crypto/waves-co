import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { formatCycleNumber } from "@/lib/cycle";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/cycles/[id] — full cycle detail for the stepper UI:
 * goal, template versions (newest first), per-status order counts, recent
 * jobs, and the immutable report if the cycle is closed.
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
          goals: { orderBy: { createdAt: "asc" } },
          templates: { orderBy: { version: "desc" } },
          cycleReport: true,
        },
      });
      if (!cycle) return null;
      const statuses = ["READY_FOR_APPROVAL", "PENDING", "APPROVED", "SENT", "DELIVERED", "FAILED", "REJECTED", "CANCELLED"] as const;
      const counts: Record<string, number> = {};
      for (const s of statuses) {
        counts[s] = await tx.outreachOrder.count({ where: { tenantId, cycleId: cycle.id, status: s } });
      }
      const jobs = await tx.aiJob.findMany({
        where: { tenantId, cycleId: cycle.id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, operation: true, status: true, attempt: true, error: true, updatedAt: true, createdAt: true },
      });
      const n8nJobs = await tx.n8nJob.findMany({
        where: { tenantId, cycleId: cycle.id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, event: true, status: true, attempts: true, lastError: true, updatedAt: true, createdAt: true },
      });
      return { cycle: { ...cycle, label: formatCycleNumber(cycle.cycleNumber) }, counts, jobs, n8nJobs };
    });
    if (!result) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load cycle." }, { status: 500 });
  }
}
