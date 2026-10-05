import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { LEASE_PRICES, isPaidLeaseType } from "@/lib/leases";
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from "@/lib/razorpay";
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
    // Locked commercial model: only paid leases can be ordered. Trial has no
    // order and can never be purchased. Client amount is ignored — price is
    // always server-computed from LEASE_PRICES.
    if (!leaseType || !isPaidLeaseType(leaseType)) {
      return NextResponse.json({ error: "Invalid leaseType. Use LEASE_30/90/180/365" }, { status: 400 });
    }
    const pricing = LOCKED[leaseType as keyof typeof LOCKED];
    // Check Razorpay config
    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "payment_provider_not_configured", detail: "RAZORPAY_KEY_ID/SECRET missing — checkout boundary" }, { status: 503 });
    }
    const idempotencyKey = body.idempotencyKey || `${tenantId}:${leaseType}:${randomUUID()}`;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      // idempotency: return existing pending order for same key
      const existing = await tx.acquisitionOrder.findUnique({ where: { idempotencyKey } }).catch(() => null);
      if (existing) return { order: existing, reused: true, keyId: getRazorpayKeyId() };
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
      // Create Razorpay order via server-side API call (secret stays on server)
      const { ok, data: j } = await createRazorpayOrder({
        amountPaise: pricing.paise,
        currency: "INR",
        receipt: order.id,
        notes: { tenantId, leaseType },
      });
      if (!ok) {
        await tx.acquisitionOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", meta: { error: j.error || "razorpay order create failed" } } });
        throw new Error(j.error?.description || "Razorpay order failed");
      }
      const updated = await tx.acquisitionOrder.update({ where: { id: order.id }, data: { providerOrderId: j.id, status: "PAYMENT_PENDING" } });
      await tx.auditLog.create({ data: { tenantId, userId, action: "billing.order.create", model: "AcquisitionOrder", recordId: order.id, after: updated } });
      // keyId is the PUBLIC key ID required by checkout.js — never the secret.
      return { order: updated, razorpayOrder: j, keyId: getRazorpayKeyId() };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}