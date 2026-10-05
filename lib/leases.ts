/**
 * Acquisition OS — locked commercial model (single source of truth).
 *
 * One complete product. No tiers. Lease duration is the only variable.
 *
 *   30 days  -> Rs 60,000
 *   90 days  -> Rs 1,65,000
 *   180 days -> Rs 3,00,000
 *   365 days -> Rs 5,40,000
 *
 * Trial: 2-day free proof period. No automatic renewal.
 *
 * CLIENT-SAFE: this module has zero server imports so UI components
 * (`/billing`, `LeasePricing`, `CheckoutButton`) can import it without
 * pulling in Prisma. Server code (`lib/billing.ts`, API routes) must
 * import pricing from here — never duplicate amounts.
 */

export const TRIAL_DAYS = 2;

export type LeaseTypeString =
  | "TRIAL_2D"
  | "LEASE_30"
  | "LEASE_90"
  | "LEASE_180"
  | "LEASE_365";

export interface LeasePrice {
  paise: number;
  days: number;
  rupees: number;
  monthly: number;
  save: number;
}

export const LEASE_PRICES: Record<LeaseTypeString, LeasePrice> = {
  LEASE_30: { paise: 6000000, days: 30, rupees: 60000, monthly: 60000, save: 0 },
  LEASE_90: { paise: 16500000, days: 90, rupees: 165000, monthly: 55000, save: 15000 },
  LEASE_180: { paise: 30000000, days: 180, rupees: 300000, monthly: 50000, save: 60000 },
  LEASE_365: { paise: 54000000, days: 365, rupees: 540000, monthly: 45000, save: 240000 },
  TRIAL_2D: { paise: 0, days: 2, rupees: 0, monthly: 0, save: 0 },
};

export interface LeaseOption {
  days: 30 | 90 | 180 | 365;
  leaseType: Exclude<LeaseTypeString, "TRIAL_2D">;
  pricePaise: number;
  monthlyPaise: number;
  savePaise: number;
  label: string;
}

export const LEASES: LeaseOption[] = [
  { days: 30, leaseType: "LEASE_30", pricePaise: 6000000, monthlyPaise: 6000000, savePaise: 0, label: "30 Days" },
  { days: 90, leaseType: "LEASE_90", pricePaise: 16500000, monthlyPaise: 5500000, savePaise: 1500000, label: "90 Days" },
  { days: 180, leaseType: "LEASE_180", pricePaise: 30000000, monthlyPaise: 5000000, savePaise: 6000000, label: "180 Days" },
  { days: 365, leaseType: "LEASE_365", pricePaise: 54000000, monthlyPaise: 4500000, savePaise: 24000000, label: "365 Days" },
];

export const LEASE_TYPE_BY_DAYS: Record<number, LeaseTypeString> = {
  30: "LEASE_30",
  90: "LEASE_90",
  180: "LEASE_180",
  365: "LEASE_365",
};

export const PAID_LEASE_TYPES = ["LEASE_30", "LEASE_90", "LEASE_180", "LEASE_365"] as const;

export function isPaidLeaseType(v: string): v is Exclude<LeaseTypeString, "TRIAL_2D"> {
  return (PAID_LEASE_TYPES as readonly string[]).includes(v);
}

export function isValidLeaseType(v: string): v is LeaseTypeString {
  return v in LEASE_PRICES;
}

export function amountForLease(leaseType: string): number {
  const e = LEASE_PRICES[leaseType as LeaseTypeString];
  if (!e) throw new Error("Invalid leaseType");
  return e.paise;
}

export function leaseTypeForDays(days: number): LeaseTypeString | null {
  return LEASE_TYPE_BY_DAYS[days] ?? null;
}

export function formatINRPaise(paise: number): string {
  return `\u20B9${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatINRRupees(rupees: number): string {
  return `\u20B9${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
