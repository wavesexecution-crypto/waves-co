/**
 * Shared job-state-machine primitives for AiJob and N8nJob.
 *
 * Lifecycle: PENDING -> PROCESSING -> COMPLETED
 * Failure:   PROCESSING -> FAILED -> RETRY_PENDING -> PROCESSING
 *
 * Design constraints (first-10-clients reliability):
 * - Claims are compare-and-set with a lease: only one worker can own a job,
 *   and a crashed worker's lease goes stale so the job is recoverable.
 * - No transaction is ever held across an external call; claim, execute,
 *   and settle are three separate short transactions.
 * - Retries use capped exponential backoff; terminal FAILED is always
 *   visible (never silent); idempotency keys make replays safe.
 */
import { createHash, randomUUID } from "crypto";

export const JOB_LEASE_TTL_MS = 5 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_CAP_MS = 60 * 60 * 1000;

export type JobTable = "aiJob" | "n8nJob";

/** Deterministic idempotency key from stable job coordinates. */
export function jobKey(tenantId: string, scope: string, parts: string[]): string {
  const h = createHash("sha256");
  h.update([tenantId, scope, ...parts].join("|"));
  return h.digest("hex").slice(0, 48);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

/** Capped exponential backoff: 1m, 2m, 4m, ... up to 1h. Pure (testable). */
export function retryDelayMs(failedAttempt: number): number {
  const exp = Math.max(0, Math.min(10, failedAttempt));
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** exp);
}

function leaseField(table: JobTable): string {
  return table === "aiJob" ? "leaseClaimedAt" : "leaseClaimedAt";
}

/**
 * Atomically claim the next due job (or a specific one) for processing.
 * Returns the claimed row, or null when nothing is claimable.
 */
export async function claimJob(
  tx: any,
  table: JobTable,
  opts: { jobId?: string; tenantId?: string; now?: Date } = {},
): Promise<any | null> {
  const now = opts.now ?? new Date();
  const staleBefore = new Date(now.getTime() - JOB_LEASE_TTL_MS);
  const lease = leaseField(table);
  const base: any = {
    OR: [
      { status: "PENDING" },
      { status: "RETRY_PENDING", nextRetryAt: { lte: now } },
      { status: "PROCESSING", [lease]: { lt: staleBefore } },
      { status: "PROCESSING", [lease]: null },
    ],
  };
  if (opts.jobId) base.id = opts.jobId;
  if (opts.tenantId) base.tenantId = opts.tenantId;

  const candidate = await tx[table].findFirst({ where: base, orderBy: { updatedAt: "asc" } });
  if (!candidate) return null;

  const attemptField = table === "aiJob" ? "attempt" : "attempts";
  const claimed = await tx[table].updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "PENDING" },
        { status: "RETRY_PENDING", nextRetryAt: { lte: now } },
        { status: "PROCESSING", [lease]: { lt: staleBefore } },
        { status: "PROCESSING", [lease]: null },
      ],
    },
    data: { status: "PROCESSING", [lease]: now, [attemptField]: { increment: 1 } },
  });
  if (claimed.count !== 1) return null; // lost the race
  return { ...candidate, status: "PROCESSING", [lease]: now };
}

/** Settle a claimed job as COMPLETED (no-op unless still PROCESSING). */
export async function completeJob(tx: any, table: JobTable, jobId: string, result: unknown): Promise<boolean> {
  // AiJob carries `error`, N8nJob carries `lastError` — only touch the
  // field that exists on the table (Prisma rejects unknown fields).
  const data: any =
    table === "aiJob"
      ? { status: "COMPLETED", result: result ?? null, error: null, nextRetryAt: null }
      : { status: "COMPLETED", result: null, lastError: null, nextRetryAt: null };
  const done = await tx[table].updateMany({ where: { id: jobId, status: "PROCESSING" }, data });
  return done.count === 1;
}

/**
 * Settle a claimed job as failed: RETRY_PENDING with backoff while attempts
 * remain, otherwise terminal FAILED (always visible, never silent).
 */
export async function failJob(
  tx: any,
  table: JobTable,
  job: { id: string },
  error: string,
  maxAttempts: number,
): Promise<"retry" | "failed"> {
  const row = await tx[table].findUnique({ where: { id: job.id } });
  if (!row || row.status !== "PROCESSING") return "failed";
  const attempts = (row.attempt ?? row.attempts ?? 1) as number;
  const err = String(error ?? "unknown error").slice(0, 2000);
  if (attempts >= maxAttempts) {
    await tx[table].update({
      where: { id: job.id },
      data: { status: "FAILED", error: err, lastError: err, nextRetryAt: null },
    });
    return "failed";
  }
  await tx[table].update({
    where: { id: job.id },
    data: {
      status: "RETRY_PENDING",
      error: err,
      lastError: err,
      nextRetryAt: new Date(Date.now() + retryDelayMs(attempts)),
    },
  });
  return "retry";
}
