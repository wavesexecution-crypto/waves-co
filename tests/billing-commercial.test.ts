/**
 * Acquisition OS — locked commercial model regression tests.
 *
 * One complete product. No tiers. Lease duration is the only variable.
 *   30d = Rs 60,000 | 90d = Rs 1,65,000 | 180d = Rs 3,00,000 | 365d = Rs 5,40,000
 * Trial = 2 days. No auto-renewal.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEASES,
  LEASE_PRICES,
  TRIAL_DAYS,
  amountForLease,
  isPaidLeaseType,
  isValidLeaseType,
} from "@/lib/leases";
import { hasCommercialAccess } from "@/lib/billing";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

describe("locked lease pricing", () => {
  it("matches the commercial model in paise", () => {
    expect(LEASE_PRICES.LEASE_30).toMatchObject({ paise: 6000000, days: 30, rupees: 60000 });
    expect(LEASE_PRICES.LEASE_90).toMatchObject({ paise: 16500000, days: 90, rupees: 165000 });
    expect(LEASE_PRICES.LEASE_180).toMatchObject({ paise: 30000000, days: 180, rupees: 300000 });
    expect(LEASE_PRICES.LEASE_365).toMatchObject({ paise: 54000000, days: 365, rupees: 540000 });
    expect(LEASE_PRICES.TRIAL_2D).toMatchObject({ paise: 0, days: 2 });
  });

  it("trial is exactly 2 days", () => {
    expect(TRIAL_DAYS).toBe(2);
    expect(LEASE_PRICES.TRIAL_2D.days).toBe(2);
  });

  it("LEASES display table matches LEASE_PRICES (no drift)", () => {
    for (const l of LEASES) {
      const p = LEASE_PRICES[l.leaseType];
      expect(l.pricePaise).toBe(p.paise);
      expect(l.days).toBe(p.days);
    }
    expect(LEASES.map((l) => l.days).sort((a, b) => a - b)).toEqual([30, 90, 180, 365]);
  });

  it("only paid leases can be ordered; trial can never be purchased", () => {
    expect(isPaidLeaseType("LEASE_30")).toBe(true);
    expect(isPaidLeaseType("LEASE_365")).toBe(true);
    expect(isPaidLeaseType("TRIAL_2D")).toBe(false);
    expect(isValidLeaseType("LEASE_15")).toBe(false);
    expect(() => amountForLease("LEASE_15")).toThrow();
  });
});

describe("commercial access rule (single product, no tiers)", () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it("allows valid TRIAL and valid ACTIVE", () => {
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: future })).toBe(true);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: future })).toBe(true);
  });

  it("blocks expired trial, expired lease, and terminal states", () => {
    expect(hasCommercialAccess(null)).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: past })).toBe(false);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: past })).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL_EXPIRED", trialExpiresAt: future })).toBe(false);
    expect(hasCommercialAccess({ status: "EXPIRED", expiresAt: future })).toBe(false);
    expect(hasCommercialAccess({ status: "CANCELLED" })).toBe(false);
    expect(hasCommercialAccess({ status: "REFUNDED" })).toBe(false);
    expect(hasCommercialAccess({ status: "NONE" })).toBe(false);
  });
});

describe("no legacy tier logic", () => {
  it("Tenant.plan defaults to the single-product value, not a tier", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/plan\s+String\s+@default\("one"\)/);
    expect(schema).not.toMatch(/@default\("starter"\)/);
  });

  it("no Starter/Growth/Pro/Enterprise plan gating in app code", () => {
    for (const f of ["lib/billing.ts", "lib/leases.ts", "app/billing/page.tsx", "app/api/billing/orders/route.ts"]) {
      const src = read(f);
      expect(src).not.toMatch(/STARTER|GROWTH|\bPRO\b|ENTERPRISE/i);
    }
  });

  it("billing UI states one product, duration only, no tiers, no auto-renewal", () => {
    const billing = read("app/billing/page.tsx");
    expect(billing).toMatch(/No tiers/i);
    const pricing = read("components/lease-pricing.tsx");
    expect(pricing).toMatch(/No tiers/i);
    expect(pricing).toMatch(/No auto-renewal/i);
  });
});

describe("no automatic renewal", () => {
  it("no auto-renewal implementation in commercial paths (explicit extension only)", () => {
    for (const f of [
      "lib/billing.ts",
      "lib/leases.ts",
      "app/api/billing/orders/route.ts",
      "app/api/billing/verify/route.ts",
      "app/api/billing/trial/start/route.ts",
    ]) {
      const src = read(f);
      // Implementation patterns that would indicate automatic charging.
      expect(src).not.toMatch(/autoRenew|auto_renew|recurringPayment|createSubscription|scheduleRenew/i);
      // Renewal must only ever be explicit (comments/docs saying "no
      // auto-renewal" or "explicit extension" are required, not violations).
      expect(src).not.toMatch(/setInterval.*renew|setTimeout.*renew|cron.*renew/i);
    }
    // The product must state no auto-renewal to the client.
    expect(read("components/lease-pricing.tsx")).toMatch(/No auto-renewal/i);
    expect(read("components/checkout-button.tsx")).toMatch(/No auto-renewal/i);
  });
});

describe("server-trust boundaries", () => {
  it("orders route never trusts client amount; price is server-computed", () => {
    const src = read("app/api/billing/orders/route.ts");
    expect(src).not.toMatch(/body\.amount|amountPaise.*body|body.*amountPaise/);
    expect(src).toMatch(/amountPaise: pricing\.paise/);
  });

  it("billing page is expiry-aware (uses getEntitlement, not a raw query)", () => {
    const src = read("app/billing/page.tsx");
    expect(src).toMatch(/getEntitlement/);
    expect(src).not.toMatch(/acquisitionEntitlement\.findUnique/);
  });

  it("trial start blocks paid-history reuse and clears stale paid fields", () => {
    const src = read("app/api/billing/trial/start/route.ts");
    expect(src).toMatch(/trialStartedAt/);
    expect(src).toMatch(/orderId/);
    expect(src).toMatch(/TRIAL_DAYS/);
  });

  it("verify delegates price/lock enforcement to the shared integrity guard", () => {
    // The locked-price, currency and amount checks moved into
    // lib/entitlement.ts so the browser callback and the webhook cannot drift.
    // The route must actually call it, not re-implement it.
    const src = read("app/api/billing/verify/route.ts");
    expect(src).toMatch(/verifyLeaseIntegrity/);
    expect(src).toMatch(/activateLeaseForPayment/);
    // Still fail-closed on the two things only the route can know.
    expect(src).toMatch(/Order tenant mismatch/);
    expect(src).toMatch(/verifyRazorpaySignature/);
    // It must never activate straight from the client's own payload.
    expect(src).not.toMatch(/body\.amountPaise|body\.expiresAt|body\.tenantId/);
  });

  it("webhook is the authoritative recovery path for abandoned payments", () => {
    const src = read("app/api/billing/razorpay/webhook/route.ts");
    expect(src).toMatch(/x-razorpay-signature/);
    expect(src).toMatch(/verifyWebhookSignature/);
    expect(src).toMatch(/payment\.captured|refund\.processed/);
    expect(src).toMatch(/verifyLeaseIntegrity/);
    expect(src).toMatch(/activateLeaseForPayment/);
    // Tenant from notes must be re-checked against the order's own tenantId.
    expect(src).toMatch(/order\.tenantId !== tenantId/);
    // Compare-and-set keeps a webhook + browser race to a single activation.
    expect(src).toMatch(/paymentId: null/);
  });
});
