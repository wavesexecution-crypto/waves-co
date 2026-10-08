import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/reply-reports/[id]/takeover — TAKE OVER (honest).
 * Transfers the reply into client-control mode: records the takeover with a
 * persisted `takeover` direction and returns the full conversation bundle
 * (original message, prospect reply, lifecycle history, intelligence). There
 * is no fake live-chat handoff: the client acts from this context using the
 * real follow-up/direction actions.
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
      const report = await tx.replyReport.findFirst({
        where: { id, tenantId },
        include: { directions: { orderBy: { createdAt: "desc" } } },
      });
      if (!report) return { error: "Reply report not found", status: 404 };
      const order = await tx.outreachOrder.findFirst({ where: { id: report.orderId, tenantId } });
      const history = order
        ? await tx.leadLifecycleEvent.findMany({ where: { tenantId, orderId: order.id }, orderBy: { createdAt: "asc" }, take: 50 })
        : [];
      let direction = report.directions.find((d: any) => d.kind === "takeover");
      let updated = report;
      if (!report.takenOverAt) {
        if (!direction) {
          direction = await tx.replyDirection.create({
            data: { tenantId, replyReportId: report.id, kind: "takeover", status: "acknowledged" },
          });
        }
        updated = await tx.replyReport.update({
          where: { id: report.id },
          data: { takenOverAt: new Date(), takenOverBy: userId ?? null },
        });
      }
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.reply.takeover", model: "ReplyReport", recordId: report.id },
      }).catch(() => null);
      return {
        report: updated,
        direction,
        conversation: {
          originalMessage: order ? { subject: order.subject, body: order.body, sentAt: order.sentAt } : null,
          prospectReply: report.replyText ? { text: report.replyText, receivedAt: report.replyReceivedAt } : null,
          history: history.map((h: any) => ({ stage: h.stage, status: h.status, reason: h.reason, createdAt: h.createdAt })),
          intelligence: {
            replyStatus: updated.replyStatus, intent: updated.intent, sentiment: updated.sentiment,
            summary: updated.summary, signals: updated.signals, objections: updated.objections,
            askingFor: updated.askingFor, recommendedAction: updated.recommendedAction,
            recommendedDirection: updated.recommendedDirection,
          },
        },
      };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not take over reply." }, { status: 500 });
  }
}
