import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { formatCycleNumber } from "@/lib/cycle";
import { computeCycleMetrics } from "@/lib/cycle-metrics";
import { createAiJob } from "@/lib/ai-jobs";
import { emitN8nEvent } from "@/lib/n8n";
import { onCycleReportReady } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/cycles/[id]/close — STEP 6 completion.
 *
 * Atomically: metrics are computed deterministically from stored rows and
 * persisted with the report; the cycle flips to CLOSED; an AI narrative job
 * (CYCLE_ANALYSIS) is queued. The report is immutable afterwards (no update
 * route exists). Idempotent: closing twice returns the existing report.
 * A best-effort n8n event is emitted only when n8n is configured.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "cycle");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
    }

    await requireCommercialAccess(tenantId);
    const { id } = await params;

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const cycle = await tx.acquisitionCycle.findFirst({ where: { id, tenantId } });
      if (!cycle) return { error: "Cycle not found", status: 404 };
      const existing = await tx.cycleReport.findUnique({ where: { cycleId: cycle.id } });
      if (existing || cycle.status === "CLOSED") {
        const report = existing ?? null;
        return { report, reused: true, cycle: { ...cycle, label: formatCycleNumber(cycle.cycleNumber) } };
      }
      const metrics = await computeCycleMetrics(tx, tenantId, cycle);
      const now = new Date();
      const updated = await tx.acquisitionCycle.updateMany({
        where: { id: cycle.id, status: "ACTIVE" },
        data: { status: "CLOSED", closedAt: now },
      });
      if (updated.count !== 1) return { error: "Cycle changed concurrently — reload and retry.", status: 409 };
      let report: any;
      try {
        report = await tx.cycleReport.create({
          data: {
            tenantId, cycleId: cycle.id, cycleNumber: cycle.cycleNumber,
            metrics: metrics as any, narrative: null, status: "final_metrics_pending_narrative",
          },
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          report = await tx.cycleReport.findUnique({ where: { cycleId: cycle.id } });
          return { report, reused: true, cycle: { ...cycle, status: "CLOSED", label: formatCycleNumber(cycle.cycleNumber) } };
        }
        throw e;
      }
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.cycle.close", model: "AcquisitionCycle", recordId: cycle.id, after: { cycleNumber: cycle.cycleNumber } },
      }).catch(() => null);
      return { report, reused: false, cycle: { ...cycle, status: "CLOSED", closedAt: now, label: formatCycleNumber(cycle.cycleNumber) } };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    if (!(result as any).reused) {
      onCycleReportReady(tenantId, (result as any).cycle.id, {}, userId);
    }

    // Narrative + automation fan-out are best-effort and retryable; the
    // immutable metrics report above is already the source of truth.
    let narrativeJob: any = null;
    try {
      const created: any = await createAiJob({
        tenantId, cycleId: (result as any).cycle.id, operation: "CYCLE_ANALYSIS",
        inputRef: { cycleId: (result as any).cycle.id, reportId: (result as any).report.id, metrics: (result as any).report.metrics },
        idempotencyParts: ["cycle-narrative", (result as any).report.id],
      });
      narrativeJob = created.job;
      await withTenantContext(tenantId, async (tx: any) => {
        await tx.cycleReport.update({ where: { id: (result as any).report.id }, data: { narrativeJobId: created.job.id } });
      });
    } catch { narrativeJob = null; }
    try {
      await emitN8nEvent({
        tenantId, cycleId: (result as any).cycle.id, event: "cycle.closed",
        payload: { reportId: (result as any).report.id, cycleNumber: (result as any).cycle.cycleNumber },
        idempotencyParts: ["cycle-closed", (result as any).report.id],
      });
    } catch { /* n8n bridge never blocks the close */ }
    return NextResponse.json({ ...(result as any), narrativeJob });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    console.error("[cycles/close] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal", detail: "Could not close cycle." }, { status: 500 });
  }
}
