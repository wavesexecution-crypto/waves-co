import { withTenantContext } from "./context";
import {
  LEASE_PRICES,
  amountForLease as amountForLeaseLocked,
  isPaidLeaseType,
  isValidLeaseType as isValidLeaseTypeLocked,
} from "./leases";

export { LEASE_PRICES } from "./leases";
export type { LeasePrice, LeaseTypeString as LeaseType } from "./leases";

export type EntitlementStatus = "TRIAL" | "TRIAL_EXPIRED" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "REFUNDED";

export function isValidLeaseType(v: string): v is keyof typeof LEASE_PRICES {
  return isValidLeaseTypeLocked(v);
}

export function amountForLease(leaseType: string): number {
  return amountForLeaseLocked(leaseType);
}

export { isPaidLeaseType };

/**
 * Single commercial access rule for Acquisition OS (one product, no tiers):
 * - TRIAL with unexpired trialExpiresAt -> access
 * - ACTIVE with unexpired expiresAt (or null expiry treated as active) -> access
 * - Everything else (NONE, TRIAL_EXPIRED, EXPIRED, CANCELLED, REFUNDED,
 *   expired timestamps) -> no access.
 *
 * Expired tenants stay able to sign in and open /billing to extend;
 * feature routes must call requireCommercialAccess().
 */
export function hasCommercialAccess(ent: any): boolean {
  if (!ent) return false;
  const now = new Date();
  if (ent.status === "TRIAL") {
    if (!ent.trialExpiresAt) return false;
    return new Date(ent.trialExpiresAt) >= now;
  }
  if (ent.status === "ACTIVE") {
    if (ent.expiresAt && new Date(ent.expiresAt) < now) return false;
    return true;
  }
  return false;
}

export async function getEntitlement(tenantId: string) {
  return withTenantContext(tenantId, async (tx: any) => {
    const e = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
    if(!e) return null;
    // lazy expiry check
    const now = new Date();
    if(e.status === "TRIAL" && e.trialExpiresAt && new Date(e.trialExpiresAt) < now) {
      const updated = await tx.acquisitionEntitlement.update({ where: { tenantId }, data: { status: "TRIAL_EXPIRED" } });
      return updated;
    }
    if(e.status === "ACTIVE" && e.expiresAt && new Date(e.expiresAt) < now) {
      const updated = await tx.acquisitionEntitlement.update({ where: { tenantId }, data: { status: "EXPIRED" } });
      return updated;
    }
    return e;
  });
}

export async function requireActiveEntitlement(tenantId: string) {
  return requireCommercialAccess(tenantId);
}

/** Enforced gate for paid Acquisition OS features. Allows valid TRIAL or ACTIVE. */
export async function requireCommercialAccess(tenantId: string) {
  const e = await getEntitlement(tenantId);
  if (!hasCommercialAccess(e)) {
    const err: any = new Error("ENTITLEMENT_REQUIRED");
    err.status = 402;
    throw err;
  }
  return e;
}
