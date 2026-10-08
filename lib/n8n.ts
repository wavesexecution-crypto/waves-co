/**
 * n8n automation bridge. The Acquisition OS database stays authoritative:
 * - Outbound: the OS records an N8nJob (PENDING) and POSTs a signed event to
 *   the configured n8n workflow. Unconfigured n8n (no base URL/secret) is NOT
 *   an error — the job stays PENDING with a visible reason and is retryable
 *   later. Business state never lives only inside n8n.
 * - Inbound: n8n calls POST /api/n8n/webhook with HMAC-signed events carrying
 *   tenantId/cycleId/jobId/eventId. Events are exactly-once by eventId
 *   (N8nEvent log); replays return the stored outcome without re-applying.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { withTenantContext } from "./context";
import { claimJob, completeJob, failJob, jobKey, newId } from "./jobs";

export const N8N_TIMEOUT_MS = 10_000;
export const N8N_MAX_ATTEMPTS = 8;

function webhookSecret(): string | null {
  return process.env.N8N_WEBHOOK_SECRET || null;
}

function baseUrl(): string | null {
  const u = (process.env.N8N_BASE_URL || "").trim().replace(/\/$/, "");
  return u ? u : null;
}

export function signN8nPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyN8nSignature(rawBody: string, signature: string | null): boolean {
  const secret = webhookSecret();
  if (!secret || !signature) return false;
  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(signN8nPayload(rawBody, secret), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface N8nEmitInput {
  tenantId: string;
  cycleId?: string | null;
  event: string;
  payload: Record<string, unknown>;
  workflowPath?: string | null;
  idempotencyParts?: string[];
}

/**
 * Record an automation event and attempt delivery. Returns the job; delivery
 * failures keep it retryable (never silent). When n8n is unconfigured the
 * job stays PENDING with reason `n8n_not_configured`.
 */
export async function emitN8nEvent(input: N8nEmitInput): Promise<any> {
  const key = jobKey(input.tenantId, `n8n:${input.event}`, input.idempotencyParts ?? [JSON.stringify(input.payload).slice(0, 500)]);
  const created = await withTenantContext(input.tenantId, async (tx: any) => {
    const existing = await tx.n8nJob.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { job: existing, reused: true };
    const job = await tx.n8nJob.create({
      data: {
        id: newId("n8njob"), tenantId: input.tenantId, cycleId: input.cycleId ?? null,
        event: input.event, payload: payloadGuard(input.payload),
        status: "PENDING", idempotencyKey: key, attempts: 0,
      },
    });
    return { job, reused: false };
  });
  if (created.reused) return created.job;
  await attemptN8nDelivery(created.job);
  return withTenantContext(input.tenantId, async (tx: any) => tx.n8nJob.findUnique({ where: { id: created.job.id } }));
}

function payloadGuard(p: Record<string, unknown>): Record<string, unknown> {
  const s = JSON.stringify(p ?? {});
  if (s.length > 16_384) throw new Error("n8n payload exceeds 16KB");
  return p ?? {};
}

/** One delivery attempt for a PENDING/RETRY_PENDING job (no tx held on HTTP). */
export async function attemptN8nDelivery(job: any): Promise<void> {
  const tenantId = job.tenantId as string;
  const url = baseUrl();
  const secret = webhookSecret();
  if (!url || !secret) {
    await withTenantContext(tenantId, async (tx: any) => {
      await tx.n8nJob.updateMany({
        where: { id: job.id, status: { in: ["PENDING", "RETRY_PENDING"] } },
        data: { status: "PENDING", lastError: "n8n_not_configured: N8N_BASE_URL/N8N_WEBHOOK_SECRET unset. Job retained, retryable.", nextRetryAt: new Date(Date.now() + 15 * 60 * 1000) },
      });
    });
    return;
  }
  const claimed = await withTenantContext(tenantId, (tx: any) => claimJob(tx, "n8nJob", { jobId: job.id }));
  if (!claimed) return;
  const started = Date.now();
  try {
    const path = (job.payload as any)?.workflowPath || (job as any).workflowPath || "/webhook/acquisition-os";
    const body = JSON.stringify({
      tenantId, cycleId: job.cycleId ?? null, jobId: job.id,
      eventId: job.idempotencyKey, event: job.event, payload: job.payload,
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), N8N_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${url}${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "X-Waves-Signature": signN8nPayload(body, secret), "X-Waves-Event": job.event, "X-Waves-Job": job.id },
        body,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
    await withTenantContext(tenantId, async (tx: any) => {
      await completeJob(tx, "n8nJob", job.id, { delivered: true, latencyMs: Date.now() - started });
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 1000);
    await withTenantContext(tenantId, async (tx: any) => {
      await failJob(tx, "n8nJob", job, msg, N8N_MAX_ATTEMPTS);
    });
  }
}

/** Advance due n8n jobs (bounded per call). */
export async function processDueN8nJobs(tenantId: string, limit = 5): Promise<Array<{ id: string; outcome: string }>> {
  const outcomes: Array<{ id: string; outcome: string }> = [];
  for (let i = 0; i < limit; i++) {
    const next = await withTenantContext(tenantId, async (tx: any) => {
      const now = new Date();
      return tx.n8nJob.findFirst({
        where: {
          tenantId,
          OR: [{ status: "PENDING" }, { status: "RETRY_PENDING", nextRetryAt: { lte: now } }],
        },
        orderBy: { updatedAt: "asc" },
      });
    });
    if (!next) break;
    try {
      await attemptN8nDelivery(next);
      outcomes.push({ id: next.id, outcome: "attempted" });
    } catch (e: any) {
      outcomes.push({ id: next.id, outcome: `error: ${String(e?.message ?? e).slice(0, 200)}` });
    }
  }
  return outcomes;
}

export function n8nHealth(): { configured: boolean; baseUrl: boolean; secret: boolean } {
  return { configured: !!(baseUrl() && webhookSecret()), baseUrl: !!baseUrl(), secret: !!webhookSecret() };
}
