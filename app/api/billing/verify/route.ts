import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { fetchRazorpayPayment, isRazorpayConfigured, verifyRazorpaySignature } from "@/lib/razorpay";
import { activateLeaseForPayment, verifyLeaseIntegrity } from "@/lib/entitlement";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/verify — browser checkout callback.
 *
 * This is the fast path: it confirms with Razorpay that the payment was
 * captured and activates the lease immediately so the customer is not left
 * waiting. It is NOT the source of truth — if the customer closes the tab
 * before this runs, /api/billing/razorpay/webhook still activates the lease.
 *
 * Both paths funnel through activateLeaseForPayment(), which compare-and-sets
 * the order's paymentId, so a webhook and a callback racing on one payment
 * produce exactly one activation and one extension.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "billing");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", detail: "Too many payment attempts. Please wait and try again." },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing razorpay fields" }, { status: 400 });
    }
    if (!isRazorpayConfigured()) return NextResponse.json({ error: "payment_provider_not_configured" }, { status: 503 });

    // Client payload is never trusted for amount/currency/tenant — it is only
    // the handle used to locate our own order and to check the HMAC.
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const order = await tx.acquisitionOrder.findUnique({ where: { providerOrderId: razorpay_order_id } });
      if (!order) return { error: "Order not found", status: 404 };
      if (order.tenantId !== tenantId) return { error: "Order tenant mismatch", status: 403 };

      // Already applied by an earlier callback or by the webhook: return the
      // existing entitlement without extending a second time.
      if (order.paymentId === razorpay_payment_id) {
        const ent = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
        return { order, entitlement: ent, activated: false };
      }

      const { ok, pay } = await fetchRazorpayPayment(razorpay_payment_id);
      if (!ok || pay.status !== "captured") {
        await tx.acquisitionOrder.update({
          where: { id: order.id },
          data: { status: "PAYMENT_FAILED", paymentId: razorpay_payment_id, signature: razorpay_signature },
        });
        return { error: "Payment not captured", status: 400 };
      }

      const integrity = verifyLeaseIntegrity({
        leaseType: order.leaseType,
        orderAmountPaise: order.amountPaise,
        paidAmountPaise: Number(pay.amount ?? 0),
        orderCurrency: order.currency,
        paidCurrency: String(pay.currency ?? ""),
      });
      if (!integrity.ok) {
        return { error: integrity.error, status: 400 };
      }

      const activation = await activateLeaseForPayment(
        {
          claimOrderPayment: async (orderId: string, paymentId: string) => {
            const updated = await tx.acquisitionOrder.updateMany({
              where: { id: orderId, paymentId: null },
              data: { paymentId, signature: razorpay_signature, status: "PAYMENT_VERIFIED" },
            });
            return updated.count === 1;
          },
          currentEntitlement: () => tx.acquisitionEntitlement.findUnique({ where: { tenantId } }),
          upsertEntitlement: (data) =>
            tx.acquisitionEntitlement.upsert({
              where: { tenantId },
              create: { tenantId, product: "acquisition_os", ...data },
              update: data,
            }),
          audit: async ({ userId: uid, action, recordId, after }) => {
            await tx.auditLog
              .create({ data: { tenantId, userId: uid, action, model: "AcquisitionEntitlement", recordId, after: after as any } })
              .catch(() => null);
          },
        },
        {
          orderId: order.id,
          leaseType: order.leaseType,
          amountPaise: order.amountPaise,
          currency: order.currency,
          paymentId: razorpay_payment_id,
          userId,
        },
      );

      const updatedOrder = await tx.acquisitionOrder.findUnique({ where: { id: order.id } });
      return { order: updatedOrder, entitlement: activation.entitlement, activated: activation.activated };
    });

    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}