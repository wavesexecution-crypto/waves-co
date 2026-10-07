import { NextResponse } from "next/server";
import { withTenantContext } from "@/lib/context";
import { activateLeaseForPayment, verifyLeaseIntegrity } from "@/lib/entitlement";
import {
  extractPaymentFacts,
  isHandledEvent,
  isWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/razorpay-webhook";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/razorpay/webhook — authoritative payment reconciliation.
 *
 * Why this exists: the browser callback (/api/billing/verify) is a
 * convenience, not the source of truth. If a customer completes payment and
 * closes the tab, no callback ever fires and the lease would never activate.
 * Razorpay's webhook is the server-to-server record of the payment, so this
 * route is what actually guarantees "money taken ⇒ access granted".
 *
 * Security contract:
 * - the RAW body is signature-verified before it is parsed or acted upon;
 * - the tenant is resolved from notes our own server wrote at order creation,
 *   then the order is re-read inside that tenant's RLS context and its tenantId
 *   is re-checked — notes alone never grant access;
 * - amount, currency and lease price are re-verified against the locked table;
 * - activation is a compare-and-set on paymentId, so webhook + browser racing
 *   on one payment produce exactly one lease and one extension.
 */
export async function POST(req: Request) {
  if (!isWebhookConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  // Signature MUST be checked against the raw bytes.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!event?.event || !isHandledEvent(String(event.event))) {
    // Acknowledge unhandled events so Razorpay stops retrying them.
    return NextResponse.json({ ok: true, handled: false });
  }

  const facts = extractPaymentFacts(event);
  if (!facts) return NextResponse.json({ error: "unsupported_payload" }, { status: 400 });

  // Tenant comes from the notes WE wrote when creating the order.
  const orderEntity = event.payload?.order?.entity;
  const tenantId = orderEntity?.notes?.tenantId;
  if (!tenantId || !/^[A-Za-z0-9_]+$/.test(String(tenantId))) {
    return NextResponse.json({ error: "tenant_not_resolvable" }, { status: 400 });
  }

  try {
    const outcome = await withTenantContext(String(tenantId), async (tx: any) => {
      const order = await tx.acquisitionOrder.findUnique({ where: { providerOrderId: facts.orderId } });

      // Order missing, or it does not belong to the tenant named in the notes.
      if (!order || order.tenantId !== tenantId) return { error: "order_not_found", status: 404 };

      if (facts.status === "failed") {
        if (order.status !== "PAYMENT_VERIFIED") {
          await tx.acquisitionOrder.update({
            where: { id: order.id },
            data: { status: "PAYMENT_FAILED", paymentId: facts.paymentId, meta: { error: facts.errorDescription ?? "payment_failed" } },
          });
        }
        return { handled: true, activated: false };
      }

      if (facts.status === "refunded") {
        const refund = event.payload?.refund?.entity;
        if (order.status !== "PAYMENT_VERIFIED" || order.paymentId !== facts.paymentId) {
          return { handled: true, activated: false };
        }
        await tx.acquisitionOrder.update({
          where: { id: order.id },
          data: { status: "PAYMENT_FAILED", meta: { refundId: refund?.id ?? null, refunded: true } },
        });
        await tx.acquisitionEntitlement.updateMany({
          where: { tenantId, paymentId: facts.paymentId },
          data: { status: "REFUNDED" },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            action: "billing.refund.processed",
            model: "AcquisitionOrder",
            recordId: order.id,
            after: { refundId: refund?.id ?? null, amount: refund?.amount ?? null },
          },
        });
        return { handled: true, activated: false };
      }

      // Captured: verify integrity against the locked pricing table.
      const integrity = verifyLeaseIntegrity({
        leaseType: order.leaseType,
        orderAmountPaise: order.amountPaise,
        paidAmountPaise: facts.amountPaise,
        orderCurrency: order.currency,
        paidCurrency: facts.currency,
      });
      if (!integrity.ok) {
        await tx.acquisitionOrder.update({
          where: { id: order.id },
          data: { status: "PAYMENT_FAILED", paymentId: facts.paymentId, meta: { error: integrity.error } },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            action: "billing.webhook.rejected",
            model: "AcquisitionOrder",
            recordId: order.id,
            after: { reason: integrity.error, paymentId: facts.paymentId },
          },
        });
        return { error: integrity.error, status: 400 };
      }

      const result = await activateLeaseForPayment(
        {
          // Atomic compare-and-set: only one caller can move paymentId off NULL.
          claimOrderPayment: async (orderId: string, paymentId: string) => {
            const updated = await tx.acquisitionOrder.updateMany({
              where: { id: orderId, paymentId: null },
              data: { paymentId, status: "PAYMENT_VERIFIED" },
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
          audit: async ({ userId, action, recordId, after }) => {
            await tx.auditLog
              .create({ data: { tenantId, userId, action, model: "AcquisitionEntitlement", recordId, after: after as any } })
              .catch(() => null);
          },
        },
        {
          orderId: order.id,
          leaseType: order.leaseType,
          amountPaise: order.amountPaise,
          currency: order.currency,
          paymentId: facts.paymentId,
        },
      );

      return { handled: true, activated: result.activated };
    });

    if ((outcome as any).error) {
      return NextResponse.json({ error: (outcome as any).error }, { status: (outcome as any).status ?? 400 });
    }
    return NextResponse.json({ ok: true, ...(outcome as any) });
  } catch (e: any) {
    // 500 makes Razorpay retry, which is exactly what we want for a
    // transient database failure.
    console.error("[razorpay-webhook] processing failed", { message: e?.message });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}