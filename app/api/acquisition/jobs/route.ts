import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

const SELECT_AI = { id: true, operation: true, model: true, status: true, attempt: true, maxAttempts: true, error: true, nextRetryAt: true, createdAt: true, updatedAt: true } as const;
const SELECT_N8N = { id: true, event: true, status: true, attempts: true, lastError: true, nextRetryAt: true, createdAt: true, updatedAt: true } as const;

/**
 * GET /api/acquisition/jobs — job observability for the tenant's own work.
 * Shows AI + automation jobs with states, attempts and errors so nothing
 * fails silently. Payloads/results are intentionally excluded (summaries in
 * the cycle/report views carry the outcomes).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const q = new URL(req.url).searchParams;
    const cycleId = q.get("cycleId") || undefined;
    const status = q.get("status") || undefined;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId };
      if (cycleId) where.cycleId = cycleId;
      if (status) where.status = status;
      const [aiJobs, n8nJobs] = await Promise.all([
        tx.aiJob.findMany({ where, orderBy: { updatedAt: "desc" }, take: 50, select: SELECT_AI }),
        tx.n8nJob.findMany({ where, orderBy: { updatedAt: "desc" }, take: 50, select: SELECT_N8N }),
      ]);
      return { aiJobs, n8nJobs };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not list jobs." }, { status: 500 });
  }
}
