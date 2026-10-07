import { withTenantContext } from "./context";
import { LEASE_PRICES, isPaidLeaseType, isValidLeaseType as isValidLeaseTypeLocked, amountForLease as amountForLeaseLocked } from "./leases";
import { hasCommercialAccess as hasCommercialAccessRule, type EntitlementStatus } from "./entitlement";

export { LEASE_PRICES } from "./leases";
export type { LeasePrice, LeaseTypeString as LeaseType } from "./leases";
export type { EntitlementStatus };

/**
 * Single source of truth for the commercial access rule lives in
 * lib/entitlement.ts so the browser callback, the Razorpay webhook and the UI
 * can never disagree about who has access.
 */
export const hasCommercialAccess = hasCommercialAccessRule;

export function isValidLeaseType(v: string): v is keyof typeof LEASE_PRICES {
  return isValidLeaseTypeLocked(v);
}

export function amountForLease(leaseType: string): number {
  return amountForLeaseLocked(leaseType);
}

export { isPaidLeaseType };

/**
 * Tenant-ownership check for billing orders (IDOR guard).
 *
 * Orders are looked up by globally-unique idempotencyKey / providerOrderId. A
 * hit must never be returned to a different tenant.
 */
export function isOrderOwnedByTenant(order: any, tenantId: string): boolean {
  if (!order || !tenantId) return false;
  return order.tenantId === tenantId;
}

export async function getEntitlement(tenantId: string) {
  return withTenantContext(tenantId, async (tx: any) => {
    const e = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
    if (!e) return null;
    // Lazy expiry check so a stale row can never keep access alive.
    const now = new Date();
    if (e.status === "TRIAL" && e.trialExpiresAt && new Date(e.trialExpiresAt) < now) {
      return tx.acquisitionEntitlement.update({ where: { tenantId }, data: { status: "TRIAL_EXPIRED" } });
    }
    if (e.status === "ACTIVE" && e.expiresAt && new Date(e.expiresAt) < now) {
      return tx.acquisitionEntitlement.update({ where: { tenantId }, data: { status: "EXPIRED" } });
    }
    return e;
  });
}

export async function requireActiveEntitlement(tenantId: string) {
  return requireCommercialAccess(tenantId);
}

/** Enforced gate for paid Acquisition OS features. Allows a valid TRIAL or ACTIVE lease. */
export async function requireCommercialAccess(tenantId: string) {
  const e = await getEntitlement(tenantId);
  if (!hasCommercialAccess(e)) {
    const err: any = new Error("ENTITLEMENT_REQUIRED");
    err.status = 402;
    throw err;
  }
  return e;
}