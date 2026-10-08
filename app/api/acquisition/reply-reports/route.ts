import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createAiJob } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

const RecordReplySchema = z.object({
  orderId: z.string().min(1).max(100),
  replyText: z.string().trim().min(1).max(8000).nullish(),
  prospectName: z.string().trim().max(200).nullish(),
  classify: z.boolean().optional(),
});

const ManualReportSchema = z.object({
  orderId: z.string().min(1).max(100),
  replyStatus: z.enum(["INTERESTED", "NEUTRAL", "OBJECTION", "NOT_INTERESTED"]),
  intent: z.enum(["High", "Medium", "Low", "Unknown"]).optional(),
  sentiment: z.enum(["Positive", "Neutral", "Negative", "Unknown"]).optional(),
  summary: z.string().trim().min(10).max(2000).nullish(),
  recommendedAction: z.string().trim().max(1000).nullish(),
});

/**
 * GET /api/acquisition/reply-reports?cycleId= — tenant's reply intelligence
 * reports (the data behind Step 5). Honest: only recorded replies appear.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const cycleId = new URL(req.url).searchParams.get("cycleId") || undefined;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId };
      if (cycleId) where.cycleId = cycleId;
      const reports = await tx.replyReport.findMany({
        where, orderBy: { updatedAt: "desc" }, take: 100,
        include: { directions: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
      return { reports };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not list reply reports." }, { status: 500 });
  }
}

/**
 * POST /api/acquisition/reply-reports — record a prospect reply for an own
 * order (replies arrive in the tenant's own inbox today; the tenant pastes
 * or confirms them here). Upserts one live report per order; optionally
 * queues REPLY_CLASSIFICATION (validated AI fills the intelligence fields,
 * never overwrites a newer manual edit).
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
    const manual = ManualReportSchema.safeParse(body);
    const recorded = RecordReplySchema.safeParse(body);
    if (!manual.success && !recorded.success) return NextResponse.json({ error: "Invalid reply report" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const orderId = (manual.success ? manual.data.orderId : (recorded.data as any).orderId) as string;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const order = await tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } });
      if (!order) return { error: "Order not found", status: 404 };
      const base = {
        tenantId, orderId: order.id, cycleId: order.cycleId ?? null,
        leadKey: order.leadKey, prospectName: order.contactName ?? null, company: order.businessName ?? null,
      };
      let report = await tx.replyReport.findUnique({ where: { tenantId_orderId: { tenantId, orderId: order.id } } });
      if (manual.success) {
        const data = {
          ...base,
          replyStatus: manual.data.replyStatus,
          intent: manual.data.intent ?? "Unknown",
          sentiment: manual.data.sentiment ?? "Unknown",
          summary: manual.data.summary ?? null,
          recommendedAction: manual.data.recommendedAction ?? null,
          source: "manual", aiJobId: null,
        };
        report = report
          ? await tx.replyReport.update({ where: { id: report.id }, data })
          : await tx.replyReport.create({ data });
      } else {
        const data = {
          ...base,
          replyText: (recorded.data as any).replyText ?? null,
          prospectName: (recorded.data as any).prospectName ?? order.contactName ?? null,
          replyReceivedAt: new Date(),
        };
        report = report
          ? await tx.replyReport.update({ where: { id: report.id }, data })
          : await tx.replyReport.create({ data });
      }
      // Keep the legacy replyStatus mirror in sync so stats stay truthful.
      if (report.replyStatus && report.replyStatus !== "UNCLASSIFIED") {
        await tx.outreachOrder.update({ where: { id: order.id }, data: { replyStatus: report.replyStatus } }).catch(() => null);
      }
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.reply.record", model: "ReplyReport", recordId: report.id, after: { orderId: order.id } },
      }).catch(() => null);
      return { report };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });

    let classificationJob: any = null;
    if (recorded.success && (recorded.data as any).classify !== false && (recorded.data as any).replyText) {
      const order = await withTenantContext(tenantId, async (tx: any) =>
        tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } }));
      const textHash = createHash("sha256").update(String((recorded.data as any).replyText ?? ""), "utf8").digest("hex").slice(0, 16);
      const created: any = await createAiJob({
        tenantId, cycleId: (result as any).report.cycleId, operation: "REPLY_CLASSIFICATION",
        inputRef: {
          reportId: (result as any).report.id, orderId,
          originalSubject: order?.subject ?? "", originalBody: (order?.body ?? "").slice(0, 4000),
          replyText: ((recorded.data as any).replyText ?? "").slice(0, 6000),
        },
        idempotencyParts: ["reply-classify", (result as any).report.id, textHash],
      });
      classificationJob = created.job;
    }
    return NextResponse.json({ ...(result as any), classificationJob }, { status: 201 });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    console.error("[reply-reports] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal", detail: "Could not record reply." }, { status: 500 });
  }
}
