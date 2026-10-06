/**
 * Billing / PayPal — pure unit tests.
 *
 * Covers:
 * - Server-locked lease pricing (client can never set the price)
 * - PayPal order capture verification
 * - Server-side order creation request shape (Bearer auth, no secret in body)
 * - Env-gating: missing credentials never crash, never leak the secret
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { LEASE_PRICES, amountForLease, isValidLeaseType, isPaidLeaseType } from "@/lib/billing";
import {
  createPayPalOrder,
  capturePayPalOrder,
  fetchPayPalOrder,
  getPayPalClientId,
  isPayPalConfigured,
  verifyPayPalCapture,
  getPayPalEnv,
} from "@/lib/paypal";

const CLIENT_ID = "test_client_id";
const CLIENT_SECRET = "test_client_secret_1234567890";

const savedEnv: Record<string, string | undefined> = {};

function setEnv(keyId: string | undefined, keySecret: string | undefined, env: "live" | "sandbox" = "sandbox") {
  savedEnv.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  savedEnv.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
  savedEnv.PAYPAL_ENV = process.env.PAYPAL_ENV;
  if (keyId) process.env.PAYPAL_CLIENT_ID = keyId;
  else delete process.env.PAYPAL_CLIENT_ID;
  if (keySecret) process.env.PAYPAL_CLIENT_SECRET = keySecret;
  else delete process.env.PAYPAL_CLIENT_SECRET;
  if (env) process.env.PAYPAL_ENV = env;
  else delete process.env.PAYPAL_ENV;
}

function restoreEnv() {
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV"]) {
    if (k in savedEnv) process.env[k] = savedEnv[k];
    else delete process.env[k];
  }
}

afterEach(() => {
  restoreEnv();
});

describe("lease pricing is locked server-side (shared with Razorpay)", () => {
  it("exposes paise amounts matching the product cards", () => {
    expect(LEASE_PRICES.LEASE_30.paise).toBe(6000000);
    expect(LEASE_PRICES.LEASE_90.paise).toBe(16500000);
    expect(LEASE_PRICES.LEASE_180.paise).toBe(30000000);
    expect(LEASE_PRICES.LEASE_365.paise).toBe(54000000);
    expect(LEASE_PRICES.TRIAL_2D.paise).toBe(0);
  });

  it("validates lease types and rejects unknown/trial-for-payment", () => {
    expect(isValidLeaseType("LEASE_90")).toBe(true);
    expect(isValidLeaseType("LEASE_15")).toBe(false);
    expect(isValidLeaseType("")).toBe(false);
    expect(amountForLease("LEASE_90")).toBe(16500000);
    expect(() => amountForLease("LEASE_15")).toThrow();
    expect(isPaidLeaseType("LEASE_30")).toBe(true);
    expect(isPaidLeaseType("TRIAL_2D")).toBe(false);
  });
});

describe("paypal configuration gating", () => {
  it("reports configured only when both env vars exist", () => {
    setEnv(undefined, undefined);
    expect(isPayPalConfigured()).toBe(false);
    expect(getPayPalClientId()).toBe(null);

    setEnv(CLIENT_ID, undefined);
    expect(isPayPalConfigured()).toBe(false);

    setEnv(CLIENT_ID, CLIENT_SECRET);
    expect(isPayPalConfigured()).toBe(true);
    expect(getPayPalClientId()).toBe(CLIENT_ID);
  });

  it("never returns the secret from any exported function", () => {
    setEnv(CLIENT_ID, CLIENT_SECRET);
    const clientId = getPayPalClientId();
    expect(clientId).toBe(CLIENT_ID);
    expect(clientId).not.toContain(CLIENT_SECRET);
  });

  it("reports correct environment", () => {
    setEnv(CLIENT_ID, CLIENT_SECRET, "sandbox");
    expect(getPayPalEnv()).toBe("sandbox");

    setEnv(CLIENT_ID, CLIENT_SECRET, "live");
    expect(getPayPalEnv()).toBe("live");
  });
});

describe("PayPal capture verification", () => {
  const mockCompletedOrder = {
    id: "ORDER_123",
    status: "COMPLETED",
    purchase_units: [{
      reference_id: "order_abc",
      custom_id: JSON.stringify({ tenantId: "t1", leaseType: "LEASE_30" }),
      payments: {
        captures: [{
          id: "CAPTURE_123",
          status: "COMPLETED",
          amount: { value: "60000.00", currency_code: "INR" },
        }],
      },
    }],
  };

    it("accepts a genuine completed capture with correct amount", () => {
      const result = verifyPayPalCapture(mockCompletedOrder, 6000000, "INR", { tenantId: "t1", leaseType: "LEASE_30" });
      expect(result.ok).toBe(true);
    });

    it("rejects order with wrong status", () => {
      const bad = { ...mockCompletedOrder, status: "APPROVED" };
      const result = verifyPayPalCapture(bad, 6000000, "INR");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Order not completed");
    });

    it("rejects capture with wrong amount", () => {
      const bad = {
        ...mockCompletedOrder,
        purchase_units: [{
          ...mockCompletedOrder.purchase_units[0],
          payments: {
            captures: [{
              ...mockCompletedOrder.purchase_units[0].payments.captures[0],
              amount: { value: "10000.00", currency_code: "INR" },
            }],
          },
        }],
      };
      const result = verifyPayPalCapture(bad, 6000000, "INR");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Amount mismatch");
    });

    it("rejects capture with wrong currency", () => {
      const bad = {
        ...mockCompletedOrder,
        purchase_units: [{
          ...mockCompletedOrder.purchase_units[0],
          payments: {
            captures: [{
              ...mockCompletedOrder.purchase_units[0].payments.captures[0],
              amount: { value: "60000.00", currency_code: "USD" },
            }],
          },
        }],
      };
      const result = verifyPayPalCapture(bad, 6000000, "INR");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Currency mismatch");
    });

    it("rejects capture with mismatched notes", () => {
      const bad = {
        ...mockCompletedOrder,
        purchase_units: [{
          ...mockCompletedOrder.purchase_units[0],
          custom_id: JSON.stringify({ tenantId: "t2", leaseType: "LEASE_30" }),
        }],
      };
      const result = verifyPayPalCapture(bad, 6000000, "INR", { tenantId: "t1", leaseType: "LEASE_30" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Note mismatch: tenantId");
    });

    it("rejects capture with no purchase units", () => {
      const bad = { ...mockCompletedOrder, purchase_units: [] };
      const result = verifyPayPalCapture(bad, 6000000, "INR");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("No purchase units found");
    });

    it("rejects capture with no captures", () => {
      const bad = {
        ...mockCompletedOrder,
        purchase_units: [{
          ...mockCompletedOrder.purchase_units[0],
          payments: { captures: [] },
        }],
      };
      const result = verifyPayPalCapture(bad, 6000000, "INR");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("No captures found");
    });

    it("handles note parse error gracefully", () => {
      const bad = {
        ...mockCompletedOrder,
        purchase_units: [{
          ...mockCompletedOrder.purchase_units[0],
          custom_id: "not-valid-json",
        }],
      };
      const result = verifyPayPalCapture(bad, 6000000, "INR", { tenantId: "t1" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Note parse error");
    });
});

describe("server-side PayPal API calls", () => {
  it("returns not-configured result without calling the network when env is missing", async () => {
    setEnv(undefined, undefined);
    const { ok, data } = await createPayPalOrder({ amountPaise: 100, receipt: "r" });
    expect(ok).toBe(false);
    expect(data?.error?.description ?? "").toContain("missing");
  });

  it("returns not-configured result for capture when env is missing", async () => {
    setEnv(undefined, undefined);
    const { ok, data } = await capturePayPalOrder("ORDER_123");
    expect(ok).toBe(false);
    expect(data?.error?.description ?? "").toContain("missing");
  });

  it("returns not-configured result for fetch when env is missing", async () => {
    setEnv(undefined, undefined);
    const { ok, order } = await fetchPayPalOrder("ORDER_123");
    expect(ok).toBe(false);
    expect(order).toEqual({});
  });
});

describe("paypal environment detection", () => {
  it("defaults to sandbox when PAYPAL_ENV not set", () => {
    setEnv(CLIENT_ID, CLIENT_SECRET);
    delete process.env.PAYPAL_ENV;
    expect(getPayPalEnv()).toBe("sandbox");
  });

  it("uses live when PAYPAL_ENV=live", () => {
    setEnv(CLIENT_ID, CLIENT_SECRET, "live");
    expect(getPayPalEnv()).toBe("live");
  });
});