import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { onNotificationEvent } from "@/lib/notifications";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { claimOrder, executeOrderSend } from "@/lib/outreach-send";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/outreach/send — send exactly one APPROVED order.
 *
 * Guarantees (implemented in lib/outreach-send.ts, shared with the drain):
 * - at most one external send per order (DB claim, not an in-memory check);
 * - the database transaction is closed before the slow provider call;
 * - failure releases the claim so the send is safely retryable;
 * - SENT is only recorded when the provider accepts the message. Delivery and
 *   reply states are NOT claimed — accepted is not delivered.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

    // Sending hits an external provider per call — shape bulk/retry abuse.
    const sendLimit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "outreach");
    if (!sendLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", detail: "Too many send requests. Please wait and retry." },
        { status: 429, headers: rateLimitHeaders(sendLimit) },
      );
    }

    await requireCommercialAccess(tenantId);

    const claim = await claimOrder(tenantId, orderId);
    if (claim.kind === "unauthorized") return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (claim.kind === "invalid") return NextResponse.json({ error: claim.reason }, { status: 409 });
    if (claim.kind === "reused") {
      const order = await withTenantContext(tenantId, (tx: any) =>
        tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } }),
      );
      return NextResponse.json({ order, reused: true });
    }

    const { order, sent } = await executeOrderSend({
      tenantId,
      userId,
      claim,
      notify: (event, opts) => onNotificationEvent(tenantId, event, opts),
    });
    return NextResponse.json({ order, sent });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not send. Please retry." }, { status: 500 });
  }
}
