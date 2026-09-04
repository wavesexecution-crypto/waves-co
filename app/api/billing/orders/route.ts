import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { LEASE_PRICES } from "@/lib/billing";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const LOCKED = LEASE_PRICES;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;
    const body = await req.json().catch(() => ({}));
    const leaseType = body.leaseType as string;
    if (!leaseType || !LOCKED[leaseType as keyof typeof LOCKED] || leaseType === "TRIAL_2D") {
      return NextResponse.json({ error: "Invalid leaseType. Use LEASE_30/90/180/365" }, { status: 400 });
    }
    const pricing = LOCKED[leaseType as keyof typeof LOCKED];
    // Check Razorpay config
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "payment_provider_not_configured", detail: "RAZORPAY_KEY_ID/SECRET missing — checkout boundary" }, { status: 503 });
    }
    const idempotencyKey = body.idempotencyKey || `${tenantId}:${leaseType}:${Date.now()}`;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      // idempotency: return existing pending order for same key
      const existing = await tx.acquisitionOrder.findUnique({ where: { idempotencyKey } }).catch(() => null);
      if (existing) return { order: existing, reused: true };
      const order = await tx.acquisitionOrder.create({
        data: {
          tenantId,
          leaseType,
          amountPaise: pricing.paise,
          currency: "INR",
          status: "CREATED",
          provider: "RAZORPAY",
          idempotencyKey,
          meta: { leaseType, pricing },
        },
      });
      // Create Razorpay order via fetch (server-side)
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const resp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: pricing.paise, currency: "INR", receipt: order.id, notes: { tenantId, leaseType } }),
      });
      const j: any = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        await tx.acquisitionOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", meta: { error: j.error || "razorpay order create failed" } } });
        throw new Error(j.error?.description || "Razorpay order failed");
      }
      const updated = await tx.acquisitionOrder.update({ where: { id: order.id }, data: { providerOrderId: j.id, status: "PAYMENT_PENDING" } });
      await tx.auditLog.create({ data: { tenantId, userId, action: "billing.order.create", model: "AcquisitionOrder", recordId: order.id, after: updated } });
      return { order: updated, razorpayOrder: j };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}
