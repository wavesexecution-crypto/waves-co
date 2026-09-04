import { prisma } from "./db";
import { withTenantContext } from "./context";

export const LEASE_PRICES: Record<string, { paise: number; days: number; rupees: number; monthly: number; save: number }> = {
  LEASE_30: { paise: 6000000, days: 30, rupees: 60000, monthly: 60000, save: 0 },
  LEASE_90: { paise: 16500000, days: 90, rupees: 165000, monthly: 55000, save: 15000 },
  LEASE_180:{ paise: 30000000, days: 180, rupees: 300000, monthly: 50000, save: 60000 },
  LEASE_365:{ paise: 54000000, days: 365, rupees: 540000, monthly: 45000, save: 240000 },
  TRIAL_2D:{ paise: 0, days: 2, rupees: 0, monthly: 0, save: 0 },
};

export type LeaseType = keyof typeof LEASE_PRICES;
export type EntitlementStatus = "TRIAL" | "TRIAL_EXPIRED" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "REFUNDED";

export function isValidLeaseType(v: string): v is LeaseType {
  return v in LEASE_PRICES;
}

export function amountForLease(leaseType: string): number {
  const e = LEASE_PRICES[leaseType as LeaseType];
  if(!e) throw new Error("Invalid leaseType");
  return e.paise;
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
  const e = await getEntitlement(tenantId);
  if(!e || e.status !== "ACTIVE" || (e.expiresAt && new Date(e.expiresAt) < new Date())) {
    const err: any = new Error("ENTITLEMENT_REQUIRED");
    err.status = 402;
    throw err;
  }
  return e;
}
