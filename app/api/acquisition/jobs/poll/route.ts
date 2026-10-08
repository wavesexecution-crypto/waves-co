import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { processDueAiJobs } from "@/lib/ai-jobs";
import { processDueN8nJobs } from "@/lib/n8n";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/jobs/poll — advance due work for this tenant.
 * There are no background workers on serverless: this endpoint (called by
 * the UI status views and by external schedulers) claims due AI/automation
 * jobs and executes a bounded number per call. Polling IS the worker pump —
 * the UI says "check for updates", never "AI is working" without a job.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "cycle");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
    }

    await requireCommercialAccess(tenantId);
    const [ai, n8n] = await Promise.all([
      processDueAiJobs(tenantId, 2),
      processDueN8nJobs(tenantId, 3),
    ]);
    const states = await withTenantContext(tenantId, async (tx: any) => {
      const [pending, processing, failed] = await Promise.all([
        tx.aiJob.count({ where: { tenantId, status: { in: ["PENDING", "RETRY_PENDING"] } } }),
        tx.aiJob.count({ where: { tenantId, status: "PROCESSING" } }),
        tx.aiJob.count({ where: { tenantId, status: "FAILED" } }),
      ]);
      return { pending, processing, failed };
    });
    return NextResponse.json({ ai, n8n, states });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not advance jobs." }, { status: 500 });
  }
}
