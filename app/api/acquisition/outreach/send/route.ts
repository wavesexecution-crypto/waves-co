import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { deliverEmail } from "@/lib/email-send";
import { onNotificationEvent } from "@/lib/notifications";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** A claim older than this is assumed to belong to a process that died mid-send. */
const SEND_CLAIM_TTL_MS = 5 * 60 * 1000;

type SendOutcome =
  | { kind: "reused" }
  | { kind: "unauthorized" }
  | { kind: "invalid"; reason: string }
  | { kind: "claimed"; orderId: string; email: string; subject: string; body: string; leadKey: string };

/**
 * Atomically claim the right to send this order.
 *
 * The claim is a compare-and-set: only one caller can move sendClaimedAt off
 * NULL, so two simultaneous requests cannot both reach the provider. Stale
 * claims (previous process crashed mid-send) are reclaimable after the TTL,
 * which keeps a crash from permanently blocking an order.
 *
 * This transaction is short and performs NO provider I/O.
 */
async function claimOrder(tenantId: string, orderId: string): Promise<SendOutcome> {
  return withTenantContext(tenantId, async (tx: any) => {
    const order = await tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) return { kind: "unauthorized" };

    // Already sent successfully — idempotent replay, no second email.
    if (order.sendId) return { kind: "reused" };

    // Only an APPROVED order may be sent. Re-checked here because a terminal
    // or un-approved order must never reach the provider.
    if (order.status !== "APPROVED") return { kind: "invalid", reason: `Order is not approved (${order.status})` };

    const now = new Date();
    const staleBefore = new Date(now.getTime() - SEND_CLAIM_TTL_MS);

    const claimed = await tx.outreachOrder.updateMany({
      where: {
        id: orderId,
        tenantId,
        sendId: null,
        status: "APPROVED",
        OR: [{ sendClaimedAt: null }, { sendClaimedAt: { lt: staleBefore } }],
      },
      data: { sendClaimedAt: now, sendAttempts: { increment: 1 } },
    });

    // Lost the race (or another request holds a live claim) — do not send.
    if (claimed.count !== 1) return { kind: "reused" };

    return {
      kind: "claimed",
      orderId: order.id,
      email: order.email,
      subject: order.subject,
      body: order.body,
      leadKey: order.leadKey,
    };
  });
}

/**
 * POST /api/acquisition/outreach/send — send exactly one APPROVED order.
 *
 * Guarantees:
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

    // Phase 1 — claim (short transaction, no I/O). This also enforces the
    // approval gate, so an unapproved or already-sent order is refused before
    // any provider configuration is consulted.
    const claim = await claimOrder(tenantId, orderId);
    if (claim.kind === "unauthorized") return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (claim.kind === "invalid") return NextResponse.json({ error: claim.reason }, { status: 409 });
    if (claim.kind === "reused") {
      const order = await withTenantContext(tenantId, (tx: any) =>
        tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } }),
      );
      return NextResponse.json({ order, reused: true });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Honest failure: not marked SENT, claim released so the order becomes
      // sendable again once the key is configured.
      const failed = await withTenantContext(tenantId, async (tx: any) => {
        const order = await tx.outreachOrder.update({
          where: { id: claim.orderId },
          data: { status: "FAILED", sendError: "Email provider not configured. Contact support.", sendClaimedAt: null },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey: claim.leadKey, stage: "send", status: "FAILED", reason: "provider_not_configured", orderId: claim.orderId },
        });
        return order;
      });
      // Action-required notification: the customer cannot send until this is fixed.
      onNotificationEvent(tenantId, "EMAIL_CONNECTION_ERROR", { userId });
      return NextResponse.json({ order: failed, sent: false });
    }

    // Phase 2 — provider call (no transaction held).
    let outcome: { ok: true } | { ok: false; error: string };
    try {
      outcome = await deliverEmail({
        apiKey,
        to: claim.email,
        subject: claim.subject,
        body: claim.body,
      });
    } catch (err: any) {
      outcome = { ok: false, error: String(err?.message ?? "Send failed").slice(0, 500) };
    }

    // Phase 3 — record the result (short transaction).
    const finalOrder = await withTenantContext(tenantId, async (tx: any) => {
      if (outcome.ok) {
        const sendId = `send_${randomUUID().replace(/-/g, "")}`;
        const sent = await tx.outreachOrder.update({
          where: { id: claim.orderId },
          data: {
            status: "SENT",
            sendId,
            sentAt: new Date(),
            sendError: null,
            // ACCEPTED, not DELIVERED — we know the provider took the message,
            // nothing more. Delivery/reply states require a provider webhook.
            deliveryStatus: "ACCEPTED",
            sendClaimedAt: null,
          },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey: claim.leadKey, stage: "send", status: "SENT", orderId: claim.orderId },
        });
        await tx.auditLog
          .create({ data: { tenantId, userId, action: "acquisition.outreach.send", model: "OutreachOrder", recordId: claim.orderId, after: { sendId } } })
          .catch(() => null);
        return sent;
      }
      // Release the claim so the send can be retried, and record the failure.
      const failed = await tx.outreachOrder.update({
        where: { id: claim.orderId },
        data: { status: "FAILED", sendError: outcome.error.slice(0, 500), sendClaimedAt: null },
      });
      await tx.leadLifecycleEvent.create({
        data: { tenantId, leadKey: claim.leadKey, stage: "send", status: "FAILED", reason: "provider_error", orderId: claim.orderId },
      });
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.outreach.send.failed", model: "OutreachOrder", recordId: claim.orderId, after: { error: outcome.error.slice(0, 200) } } })
        .catch(() => null);
      return failed;
    });

    // A send the provider rejected is actionable for the customer.
    if (!outcome.ok) {
      onNotificationEvent(tenantId, "EMAIL_CONNECTION_ERROR", {
        userId,
        deduplicationSuffix: `send-failed-${claim.orderId}`,
      });
    }

    return NextResponse.json({ order: finalOrder, sent: outcome.ok });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not send. Please retry." }, { status: 500 });
  }
}