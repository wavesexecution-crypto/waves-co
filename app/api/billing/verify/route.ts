import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { LEASE_PRICES } from "@/lib/billing";
import crypto from "crypto";

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
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keySecret || !keyId) return NextResponse.json({ error: "payment_provider_not_configured" }, { status: 503 });

    // Verify HMAC
    const expected = crypto.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature) {
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
      // Verify amount via Razorpay fetch (optional)
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const resp = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const pay: any = await resp.json().catch(() => ({}));
      if (!resp.ok || pay.status !== "captured") {
        await tx.acquisitionOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", paymentId: razorpay_payment_id, signature: razorpay_signature } });
        return { error: "Payment not captured", status: 400 };
      }
      if (pay.amount !== order.amountPaise || pay.currency !== order.currency) {
        return { error: "Amount mismatch", status: 400 };
      }
      const pricing = LEASE_PRICES[order.leaseType as keyof typeof LEASE_PRICES];
      if (!pricing) return { error: "Invalid leaseType on order", status: 400 };

      const updatedOrder = await tx.acquisitionOrder.update({
        where: { id: order.id },
        data: { paymentId: razorpay_payment_id, signature: razorpay_signature, status: "PAYMENT_VERIFIED" },
      });

      const now = new Date();
      const expires = new Date(now.getTime() + pricing.days * 24 * 60 * 60 * 1000);
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
