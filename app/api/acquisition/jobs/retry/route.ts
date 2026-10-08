import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

const RetrySchema = z.object({
  kind: z.enum(["ai", "n8n"]),
  jobId: z.string().min(1).max(100),
});

/**
 * POST /api/acquisition/jobs/retry — manual retry of a FAILED (or stuck)
 * job. Resets to RETRY_PENDING due now; the next poll/claim executes it.
 * Completed jobs and other tenants' jobs are never touched.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const body = await req.json().catch(() => ({}));
    const parsed = RetrySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid retry request" }, { status: 400 });
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const table = parsed.data.kind === "ai" ? "aiJob" : "n8nJob";
      const row = await tx[table].findFirst({ where: { id: parsed.data.jobId, tenantId } });
      if (!row) return { error: "Job not found", status: 404 };
      if (row.status === "COMPLETED" || row.status === "PROCESSING") {
        return { error: `Job is ${row.status} — nothing to retry`, status: 409 };
      }
      await tx[table].update({
        where: { id: row.id },
        data: { status: "RETRY_PENDING", nextRetryAt: new Date(), leaseClaimedAt: null },
      });
      return { jobId: row.id, status: "RETRY_PENDING" as const };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not retry job." }, { status: 500 });
  }
}
