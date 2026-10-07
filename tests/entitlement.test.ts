/**
 * Server-authoritative lease rules.
 *
 * Guards the five things the customer must never be able to manipulate:
 * price, duration, entitlement, tenant, expiry.
 */
import { describe, it, expect, vi } from "vitest";
import {
  activateLeaseForPayment,
  computeLeaseExpiry,
  hasCommercialAccess,
  verifyLeaseIntegrity,
} from "@/lib/entitlement";
import { LEASE_PRICES } from "@/lib/leases";

describe("locked commercial model", () => {
  it("prices are exactly the agreed lease amounts", () => {
    expect(LEASE_PRICES.LEASE_30.rupees).toBe(60000);
    expect(LEASE_PRICES.LEASE_90.rupees).toBe(165000);
    expect(LEASE_PRICES.LEASE_180.rupees).toBe(300000);
    expect(LEASE_PRICES.LEASE_365.rupees).toBe(540000);
    expect(LEASE_PRICES.TRIAL_2D.paise).toBe(0);
    expect(LEASE_PRICES.TRIAL_2D.days).toBe(2);
  });
});

describe("access rule is fail-closed", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it("grants only unexpired TRIAL or ACTIVE", () => {
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: future })).toBe(true);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: future })).toBe(true);
  });

  it("denies expired, terminal, missing-timestamp and absent entitlements", () => {
    expect(hasCommercialAccess(null)).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: past })).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL" })).toBe(false);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: past })).toBe(false);
    // An ACTIVE row with no expiry must never confer access.
    expect(hasCommercialAccess({ status: "ACTIVE" })).toBe(false);
    for (const status of ["TRIAL_EXPIRED", "EXPIRED", "CANCELLED", "REFUNDED", "NONE"]) {
      expect(hasCommercialAccess({ status, trialExpiresAt: future, expiresAt: future })).toBe(false);
    }
  });
});

describe("expiry is computed server-side and extends explicitly", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");

  it("starts from now when there is no live lease", () => {
    expect(computeLeaseExpiry(null, 30, now).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("extends from the current expiry when time remains (no lost paid days)", () => {
    const current = { status: "ACTIVE", expiresAt: new Date("2026-11-01T00:00:00.000Z") };
    expect(computeLeaseExpiry(current, 30, now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("restarts from now when the lease already expired", () => {
    const current = { status: "ACTIVE", expiresAt: new Date("2026-09-01T00:00:00.000Z") };
    expect(computeLeaseExpiry(current, 30, now).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("never extends from an expired TRIAL", () => {
    const current = { status: "TRIAL", trialExpiresAt: new Date("2026-09-01T00:00:00.000Z") };
    expect(computeLeaseExpiry(current, 90, now).toISOString()).toBe("2026-12-30T00:00:00.000Z");
  });
});

describe("payment integrity", () => {
  const base = {
    leaseType: "LEASE_30",
    orderAmountPaise: 6000000,
    paidAmountPaise: 6000000,
    orderCurrency: "INR",
    paidCurrency: "INR",
  };

  it("accepts an exact match", () => {
    expect(verifyLeaseIntegrity(base).ok).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const r = verifyLeaseIntegrity({ ...base, paidAmountPaise: 1 });
    expect(r.ok).toBe(false);
  });

  it("rejects a currency swap", () => {
    const r = verifyLeaseIntegrity({ ...base, paidCurrency: "USD" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-paid lease type (trial can never be purchased)", () => {
    const r = verifyLeaseIntegrity({ ...base, leaseType: "TRIAL_2D", orderAmountPaise: 0, paidAmountPaise: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects when pricing drifted after order creation", () => {
    const r = verifyLeaseIntegrity({ ...base, orderAmountPaise: 5500000, paidAmountPaise: 5500000 });
    expect(r.ok).toBe(false);
  });
});

describe("activation is idempotent under concurrency", () => {
  function deps() {
    const state: any = { claimed: false, entitlement: null as any, audits: [] as any[] };
    return {
      state,
      deps: {
        claimOrderPayment: vi.fn(async () => {
          if (state.claimed) return false; // second caller loses the CAS
          state.claimed = true;
          return true;
        }),
        currentEntitlement: vi.fn(async () => state.entitlement),
        upsertEntitlement: vi.fn(async (data: any) => {
          state.entitlement = { id: "ent1", ...(state.entitlement ?? {}), ...data };
          return state.entitlement;
        }),
        audit: vi.fn(async (a: any) => { state.audits.push(a); }),
      },
    };
  }

  it("two concurrent activations of one payment produce one activation", async () => {
    const { state, deps: d } = deps();
    const params = {
      orderId: "o1", leaseType: "LEASE_30", amountPaise: 6000000,
      currency: "INR", paymentId: "pay_1", now: new Date("2026-10-01T00:00:00.000Z"),
    };

    const results = await Promise.all([
      activateLeaseForPayment(d, params),
      activateLeaseForPayment(d, params),
    ]);

    expect(results.filter((r: { activated: boolean }) => r.activated)).toHaveLength(1);
    expect(d.upsertEntitlement).toHaveBeenCalledTimes(1);
    expect(state.entitlement.expiresAt.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("records an audit entry for the activating caller", async () => {
    const { state, deps: d } = deps();
    await activateLeaseForPayment(d, {
      orderId: "o1", leaseType: "LEASE_90", amountPaise: 16500000,
      currency: "INR", paymentId: "pay_1", now: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].action).toBe("billing.lease.activate");
    expect(state.entitlement.expiresAt.toISOString()).toBe("2026-12-30T00:00:00.000Z");
  });
});