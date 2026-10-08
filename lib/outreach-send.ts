/**
 * Shared outreach-send pipeline (single sends + queue drain).
 *
 * Same guarantees as the original route (which now delegates here):
 * - Atomic claim (compare-and-set) — exactly one sender per order.
 * - No transaction held across the provider call.
 * - Provider resolved per cycle: WAVES-operated platform key or the
 *   tenant's own verified key (see lib/email-provider.ts). Missing key is an
 *   honest FAILED with claim released — never a silent drop.
 * - Successful sends stamp the cycle's approved template version + the
 *   deterministically assigned message variant for truthful reporting.
 */
import { randomUUID } from "crypto";
import { withTenantContext } from "./context";
import { deliverEmail } from "./email-send";
import { resolveEmailSender, type SendProvider } from "./email-provider";
import { fillTemplateTokens } from "./acquisition";

export const SEND_CLAIM_TTL_MS = 5 * 60 * 1000;

export type SendOutcome =
  | { kind: "reused" }
  | { kind: "unauthorized" }
  | { kind: "invalid"; reason: string }
  | { kind: "claimed"; orderId: string; email: string; subject: string; body: string; leadKey: string; cycleId: string | null };

/**
 * Atomically claim the right to send this order. Only the caller whose
 * conditional UPDATE matches proceeds; everyone else gets `reused`.
 * Short transaction, NO provider I/O.
 */
export async function claimOrder(tenantId: string, orderId: string): Promise<SendOutcome> {
  return withTenantContext(tenantId, async (tx: any) => {
    const order = await tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) return { kind: "unauthorized" };
    if (order.sendId) return { kind: "reused" };
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
    if (claimed.count !== 1) return { kind: "reused" };
    return {
      kind: "claimed",
      orderId: order.id,
      email: order.email,
      subject: order.subject,
      body: order.body,
      leadKey: order.leadKey,
      cycleId: order.cycleId ?? null,
    };
  });
}

/** Deterministic variant assignment: stable per order, no randomness. */
export function assignVariant(orderId: string, variants: Array<{ label?: string }>): string {
  if (!variants.length) return "default";
  let h = 0x811c9dc5;
  for (let i = 0; i < orderId.length; i++) {
    h ^= orderId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const v = variants[h % variants.length];
  return String(v?.label ?? "default").slice(0, 80) || "default";
}

export interface ExecuteSendInput {
  tenantId: string;
  userId?: string;
  claim: Extract<SendOutcome, { kind: "claimed" }>;
  notify?: (event: "EMAIL_CONNECTION_ERROR", opts: any) => void;
}

export interface ExecuteSendResult {
  order: any;
  sent: boolean;
}

/**
 * Execute a claimed send: resolve provider -> call provider (no tx) ->
 * record result (short tx). Returns the final order + sent flag.
 */
export async function executeOrderSend(input: ExecuteSendInput): Promise<ExecuteSendResult> {
  const { tenantId, userId, claim } = input;
  const notify = input.notify ?? (() => undefined);

  // Resolve sender (short tx read inside resolveEmailSender callers use tx;
  // here we open our own short read first).
  const sender = await withTenantContext(tenantId, async (tx: any) => {
    let provider: SendProvider = "waves";
    if (claim.cycleId) {
      const cycle = await tx.acquisitionCycle?.findFirst?.({ where: { id: claim.cycleId, tenantId } });
      if (cycle?.sendProvider === "custom") provider = "custom";
    }
    return resolveEmailSender(tx, tenantId, provider);
  });

  if (!sender.apiKey) {
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
    notify("EMAIL_CONNECTION_ERROR", { userId });
    return { order: failed, sent: false };
  }

  // Phase 2 — provider call (no transaction held).
  let outcome: { ok: true } | { ok: false; error: string };
  try {
    outcome = await deliverEmail({ apiKey: sender.apiKey, to: claim.email, subject: claim.subject, body: claim.body });
  } catch (err: any) {
    outcome = { ok: false, error: String(err?.message ?? "Send failed").slice(0, 500) };
  }

  // Phase 3 — record (short tx), stamping template provenance for reports.
  const finalOrder = await withTenantContext(tenantId, async (tx: any) => {
    let templateVersion: number | null = null;
    let messageVariant = "default";
    if (claim.cycleId) {
      const approved = await tx.messageTemplate?.findFirst?.({
        where: { tenantId, cycleId: claim.cycleId, status: "approved" },
        orderBy: { version: "desc" },
      });
      if (approved) {
        templateVersion = approved.version;
        const variants = Array.isArray(approved.variants) ? approved.variants : [];
        messageVariant = assignVariant(claim.orderId, variants);
      }
    }
    if (outcome.ok) {
      const sendId = `send_${randomUUID().replace(/-/g, "")}`;
      const sent = await tx.outreachOrder.update({
        where: { id: claim.orderId },
        data: {
          status: "SENT", sendId, sentAt: new Date(), sendError: null,
          // ACCEPTED, not DELIVERED — the provider took the message, nothing more.
          deliveryStatus: "ACCEPTED", sendClaimedAt: null,
          templateVersion, messageVariant,
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

  if (!outcome.ok) {
    notify("EMAIL_CONNECTION_ERROR", { userId, deduplicationSuffix: `send-failed-${claim.orderId}` });
  }
  return { order: finalOrder, sent: outcome.ok };
}
