/**
 * Production rate limiting for abuse-sensitive surfaces.
 *
 * Scope: fixed-window counters held in process memory. This is deliberately
 * simple — the deployment target is a single Node/Vercel region and the brief
 * forbids standing up distributed infrastructure (Redis etc.) for this.
 *
 * Known limitation, stated honestly: counters are per-instance. On a
 * horizontally scaled runtime the effective limit is (limit x instances).
 * Every limit below is therefore set to tolerate that while still making
 * single-source abuse (credential stuffing, trial farming, payment probing)
 * impractical. Raise-limit-before-scale is the intended upgrade path.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  resetSeconds: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Guard against unbounded memory growth from hostile key cardinality. */
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Hard cap: if a flood of fresh keys still exceeds the ceiling, drop the
  // oldest insertion (Map preserves insertion order) rather than grow.
  while (buckets.size > MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

/**
 * Named limits for each protected surface. These are the numbers the tests
 * assert on — keep them stable unless the test is intentionally updated.
 */
export const RATE_LIMITS = {
  /** Credential stuffing / password probing on the login form. */
  login: { limit: 10, windowSeconds: 60 * 15 },
  /** Account + trial farming via disposable signups. */
  signup: { limit: 5, windowSeconds: 60 * 60 },
  /** Password-reset mail bombing of a third party. */
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  /** Free 2-day proof must not be repeatedly reclaimed or probed. */
  trialStart: { limit: 5, windowSeconds: 60 * 60 },
  /** Order creation + verification probing. */
  billing: { limit: 20, windowSeconds: 60 * 10 },
  /** Tenant-authed bulk actions: lead import, approve/reject, email sending. */
  outreach: { limit: 30, windowSeconds: 60 * 10 },
} as const;

export type RateLimitSurface = keyof typeof RATE_LIMITS;

/**
 * Consume one token for `key` on `surface`.
 * Returns allowed=false once the window is exhausted.
 */
export function consumeRateLimit(key: string, surface: RateLimitSurface): RateLimitResult {
  const cfg = RATE_LIMITS[surface];
  const now = Date.now();
  sweep(now);

  const bucketKey = `${surface}:${key}`;
  let bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + cfg.windowSeconds * 1000 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, cfg.limit - bucket.count);
  const resetSeconds = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    allowed: bucket.count <= cfg.limit,
    limit: cfg.limit,
    remaining,
    resetSeconds,
    retryAfterSeconds: bucket.count <= cfg.limit ? 0 : resetSeconds,
  };
}

/** Read-only peek — used by tests to assert state without consuming a token. */
export function peekRateLimit(key: string, surface: RateLimitSurface): number {
  const bucket = buckets.get(`${surface}:${key}`);
  if (!bucket || bucket.resetAt <= Date.now()) return 0;
  return bucket.count;
}

/** Test-only reset so suites never leak counters into each other. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client identity.
 *
 * Prefers the first address in a platform-provided forwarded chain, which is
 * what Vercel/Cloudflare set. An attacker can spoof X-Forwarded-For, so this is
 * treated as a *shaping* signal, never as an authentication factor.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
  ];
  for (const header of candidates) {
    if (!header) continue;
    const first = header.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetSeconds),
    ...(result.allowed ? {} : { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) }),
  };
}