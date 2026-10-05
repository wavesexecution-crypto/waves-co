import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { LEASE_PRICES } from "@/lib/leases";
import { fetchRazorpayPayment, isRazorpayConfigured, verifyRazorpaySignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;
    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing razorpay fields" }, { status: 400 });
    }
    if (!isRazorpayConfigured()) return NextResponse.json({ error: "payment_provider_not_configured" }, { status: 503 });

    // Verify HMAC signature — secret never leaves the server
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const order = await tx.acquisitionOrder.findUnique({ where: { providerOrderId: razorpay_order_id } });
      if (!order) return { error: "Order not found", status: 404 };
      if (order.tenantId !== tenantId) return { error: "Order tenant mismatch", status: 403 };
      if (order.paymentId === razorpay_payment_id) {
        // idempotent replay
        const ent = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
        return { order, entitlement: ent, reused: true };
      }
      // Confirm with Razorpay that the payment was actually captured
      const { ok, pay } = await fetchRazorpayPayment(razorpay_payment_id);
      if (!ok || pay.status !== "captured") {
        await tx.acquisitionOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", paymentId: razorpay_payment_id, signature: razorpay_signature } });
        return { error: "Payment not captured", status: 400 };
      }
      if (pay.amount !== order.amountPaise || pay.currency !== order.currency) {
        return { error: "Amount mismatch", status: 400 };
      }
      const pricing = LEASE_PRICES[order.leaseType as keyof typeof LEASE_PRICES];
      if (!pricing) return { error: "Invalid leaseType on order", status: 400 };
      // Locked-price guard: the order amount must equal the current locked
      // price. If pricing changed mid-checkout, reject rather than activate
      // at the wrong value.
      if (order.amountPaise !== pricing.paise) {
        return { error: "Price changed — please create a new order", status: 400 };
      }

      const updatedOrder = await tx.acquisitionOrder.update({
        where: { id: order.id },
        data: { paymentId: razorpay_payment_id, signature: razorpay_signature, status: "PAYMENT_VERIFIED" },
      });

      // Explicit extension, no auto-renewal: if the tenant still has an
      // unexpired ACTIVE lease, extend from its expiry so paid days are not
      // lost. Otherwise start now. Trial history is preserved to block reuse.
      const now = new Date();
      const current = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
      const base =
        current?.status === "ACTIVE" && current?.expiresAt && new Date(current.expiresAt) > now
          ? new Date(current.expiresAt)
          : now;
      const expires = new Date(base.getTime() + pricing.days * 24 * 60 * 60 * 1000);
      const ent = await tx.acquisitionEntitlement.upsert({
        where: { tenantId },
        create: {
          tenantId,
          product: "acquisition_os",
          status: "ACTIVE",
          leaseType: order.leaseType,
          startedAt: now,
          expiresAt: expires,
          pricePaise: pricing.paise,
          currency: "INR",
          orderId: order.id,
          paymentId: razorpay_payment_id,
        },
        update: {
          status: "ACTIVE",
          leaseType: order.leaseType,
          startedAt: now,
          expiresAt: expires,
          pricePaise: pricing.paise,
          orderId: order.id,
          paymentId: razorpay_payment_id,
        },
      });
      await tx.auditLog.create({ data: { tenantId, userId, action: "billing.verify", model: "AcquisitionEntitlement", recordId: ent.id, after: ent } });
      return { order: updatedOrder, entitlement: ent };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}