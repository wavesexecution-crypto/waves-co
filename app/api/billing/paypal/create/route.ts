import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { LEASE_PRICES, isPaidLeaseType } from "@/lib/leases";
import { createPayPalOrder, getPayPalClientId, isPayPalConfigured } from "@/lib/paypal";
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

    // Check PayPal config
    if (!isPayPalConfigured()) {
      return NextResponse.json({ error: "payment_provider_not_configured", detail: "PAYPAL_CLIENT_ID/SECRET missing — checkout boundary" }, { status: 503 });
    }

    const idempotencyKey = body.idempotencyKey || `${tenantId}:${leaseType}:paypal:${randomUUID()}`;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      // idempotency: return existing pending order for same key.
      // The key is globally unique, so ownership must be verified — a hit
      // belonging to another tenant is rejected without leaking its details.
      const existing = await tx.acquisitionOrder.findUnique({ where: { idempotencyKey } }).catch(() => null);
      if (existing) {
        if (existing.tenantId !== tenantId) {
          return { error: "Order already exists", status: 409 };
        }
        // Return the PayPal client ID for the client SDK
        return { order: existing, reused: true, clientId: getPayPalClientId() };
      }

      const order = await tx.acquisitionOrder.create({
        data: {
          tenantId,
          leaseType,
          amountPaise: pricing.paise,
          currency: "INR",
          status: "CREATED",
          provider: "PAYPAL",
          idempotencyKey,
          meta: { leaseType, pricing },
        },
      });

      // Create PayPal order via server-side API call (secret stays on server)
      const { ok, data: paypalOrder } = await createPayPalOrder({
        amountPaise: pricing.paise,
        currency: "INR",
        receipt: order.id,
        notes: { tenantId, leaseType },
      });

      if (!ok) {
        await tx.acquisitionOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", meta: { error: paypalOrder?.error?.description || "paypal order create failed" } } });
        throw new Error(paypalOrder?.error?.description || "PayPal order failed");
      }

      const updated = await tx.acquisitionOrder.update({ where: { id: order.id }, data: { providerOrderId: paypalOrder.id, status: "PAYMENT_PENDING" } });
      await tx.auditLog.create({ data: { tenantId, userId, action: "billing.order.create", model: "AcquisitionOrder", recordId: order.id, after: updated } });

      // clientId is the PUBLIC client ID required by PayPal JS SDK — never the secret.
      return { order: updated, paypalOrder, clientId: getPayPalClientId() };
    });

    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}