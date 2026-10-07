/**
 * Server-authoritative lease activation for Acquisition OS.
 *
 * This module is the single place where a paid lease becomes ACTIVE. Both the
 * browser checkout callback and the Razorpay webhook call into it, so the
 * "customer paid then closed the tab" case is recovered by the webhook while
 * the normal case is confirmed by the callback — without ever activating twice.
 *
 * Commercial model is locked in lib/leases.ts. Nothing here accepts a
 * client-supplied amount, duration, tenant or expiry.
 */

import { LEASE_PRICES, isPaidLeaseType, type LeaseTypeString } from "./leases";

export type EntitlementStatus =
  | "TRIAL"
  | "TRIAL_EXPIRED"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export interface EntitlementLike {
  status: string;
  /** Prisma returns Date, serialized payloads arrive as ISO strings — both accepted. */
  trialExpiresAt?: Date | string | null;
  expiresAt?: Date | string | null;
}

/**
 * The single commercial access rule. Fail-closed on every ambiguous state.
 */
export function hasCommercialAccess(ent: EntitlementLike | null | undefined): boolean {
  if (!ent) return false;
  const now = Date.now();
  if (ent.status === "TRIAL") {
    if (!ent.trialExpiresAt) return false;
    return new Date(ent.trialExpiresAt).getTime() >= now;
  }
  if (ent.status === "ACTIVE") {
    if (!ent.expiresAt) return false;
    return new Date(ent.expiresAt).getTime() >= now;
  }
  return false;
}

/**
 * Lease extension is explicit, never automatic: a new purchase extends from the
 * current expiry when time remains, otherwise starts now. No auto-renewal is
 * ever scheduled.
 */
export function computeLeaseExpiry(
  current: EntitlementLike | null,
  days: number,
  now: Date,
): Date {
  const stillActive =
    current?.status === "ACTIVE" &&
    !!current.expiresAt &&
    new Date(current.expiresAt).getTime() > now.getTime();

  const base = stillActive ? new Date(current!.expiresAt!) : now;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface LeaseIntegrityInput {
  /** leaseType recorded on the order row (server-created). */
  leaseType: string;
  /** amountPaise recorded on the order row. */
  orderAmountPaise: number;
  /** amount reported by the payment provider, in paise. */
  paidAmountPaise: number;
  orderCurrency: string;
  paidCurrency: string;
}

export type LeaseIntegrityResult =
  | { ok: true; pricing: (typeof LEASE_PRICES)[LeaseTypeString] }
  | { ok: false; error: string };

/**
 * Guards a payment against being applied to the wrong lease or the wrong price.
 * Rejects when pricing drifted between order creation and capture.
 */
export function verifyLeaseIntegrity(input: LeaseIntegrityInput): LeaseIntegrityResult {
  if (!isPaidLeaseType(input.leaseType)) {
    return { ok: false, error: "Invalid lease type on order" };
  }
  const pricing = LEASE_PRICES[input.leaseType];
  if (!pricing) return { ok: false, error: "Unknown lease type on order" };

  if (input.orderCurrency !== input.paidCurrency) {
    return { ok: false, error: "Currency mismatch" };
  }
  if (input.paidAmountPaise !== input.orderAmountPaise) {
    return { ok: false, error: "Amount mismatch" };
  }
  // Locked-price guard: never activate at a price that is no longer current.
  if (input.orderAmountPaise !== pricing.paise) {
    return { ok: false, error: "Price changed — order must be recreated" };
  }
  return { ok: true, pricing };
}

export interface ActivationDeps {
  /** Atomic compare-and-set on the order's paymentId. Returns true only for the winner. */
  claimOrderPayment(orderId: string, paymentId: string): Promise<boolean>;
  currentEntitlement(): Promise<EntitlementLike | null>;
  upsertEntitlement(data: {
    status: EntitlementStatus;
    leaseType: string;
    startedAt: Date;
    expiresAt: Date;
    pricePaise: number;
    currency: string;
    orderId: string;
    paymentId: string;
  }): Promise<any>;
  audit(data: { userId?: string; action: string; recordId: string; after: unknown }): Promise<void>;
}

export interface ActivateResult {
  entitlement: any;
  /** True when this call performed the activation (false = already applied). */
  activated: boolean;
}

/**
 * Activate (or re-confirm) a lease for a verified, captured payment.
 *
 * Concurrency: exactly one caller wins `claimOrderPayment`, so a webhook and a
 * browser callback racing on the same payment produce one activation and one
 * extension, never two.
 */
export async function activateLeaseForPayment(
  deps: ActivationDeps,
  params: {
    orderId: string;
    leaseType: string;
    amountPaise: number;
    currency: string;
    paymentId: string;
    now?: Date;
    userId?: string;
  },
): Promise<ActivateResult> {
  const now = params.now ?? new Date();

  const claimed = await deps.claimOrderPayment(params.orderId, params.paymentId);

  if (!claimed) {
    // Someone already activated this exact payment — re-confirm current state
    // instead of extending a second time.
    const ent = await deps.currentEntitlement();
    return { entitlement: ent, activated: false };
  }

  const pricing = LEASE_PRICES[params.leaseType as LeaseTypeString];
  if (!pricing) throw new Error("Invalid lease type");

  const current = await deps.currentEntitlement();
  const expires = computeLeaseExpiry(current, pricing.days, now);

  const entitlement = await deps.upsertEntitlement({
    status: "ACTIVE",
    leaseType: params.leaseType,
    startedAt: now,
    expiresAt: expires,
    pricePaise: pricing.paise,
    currency: params.currency,
    orderId: params.orderId,
    paymentId: params.paymentId,
  });

  await deps.audit({
    userId: params.userId,
    action: "billing.lease.activate",
    recordId: entitlement?.id ?? params.orderId,
    after: {
      leaseType: params.leaseType,
      expiresAt: expires.toISOString(),
      paymentId: params.paymentId,
    },
  });

  return { entitlement, activated: true };
}