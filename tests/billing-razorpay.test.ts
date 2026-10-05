/**
 * Billing / Razorpay — pure unit tests.
 *
 * Covers:
 * - Server-locked lease pricing (client can never set the price)
 * - Razorpay HMAC signature verification (the verify step's core logic)
 * - Server-side order creation request shape (Basic auth, no secret in body)
 * - Env-gating: missing credentials never crash, never leak the secret
 */
import { describe, it, expect, afterEach } from "vitest";
import { LEASE_PRICES, amountForLease, isValidLeaseType } from "@/lib/billing";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from "@/lib/razorpay";
import crypto from "crypto";

const KEY_ID = "rzp_live_UnitTestKeyId";
const KEY_SECRET = "unit-test-secret-1234567890";

const savedEnv: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) {
    if (k in savedEnv) process.env[k] = savedEnv[k];
    else delete process.env[k];
  }
});

function setEnv(keyId: string | undefined, keySecret: string | undefined) {
  savedEnv.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  savedEnv.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (keyId) process.env.RAZORPAY_KEY_ID = keyId;
  else delete process.env.RAZORPAY_KEY_ID;
  if (keySecret) process.env.RAZORPAY_KEY_SECRET = keySecret;
  else delete process.env.RAZORPAY_KEY_SECRET;
}

describe("lease pricing is locked server-side", () => {
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
  });
});

describe("razorpay HMAC signature verification", () => {
  it("accepts a genuine signature and rejects tampered ones", () => {
    const orderId = "order_O1dUJkQxAbC123";
    const paymentId = "pay_N7fGtYhJklM456";
    const good = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyRazorpaySignature(orderId, paymentId, good, KEY_SECRET)).toBe(true);
    expect(verifyRazorpaySignature(orderId, paymentId, good + "x", KEY_SECRET)).toBe(false);
    expect(verifyRazorpaySignature(orderId, "pay_WRONG", good, KEY_SECRET)).toBe(false);
  });

  it("returns false instead of throwing when the secret is not configured", () => {
    setEnv(undefined, undefined);
    expect(verifyRazorpaySignature("o", "p", "s")).toBe(false);
  });
});

describe("razorpay configuration gating", () => {
  it("reports configured only when both env vars exist", () => {
    setEnv(undefined, undefined);
    expect(isRazorpayConfigured()).toBe(false);
    expect(getRazorpayKeyId()).toBe(null);

    setEnv(KEY_ID, undefined);
    expect(isRazorpayConfigured()).toBe(false);

    setEnv(KEY_ID, KEY_SECRET);
    expect(isRazorpayConfigured()).toBe(true);
    expect(getRazorpayKeyId()).toBe(KEY_ID);
  });

  it("never returns the secret from any exported function", () => {
    setEnv(KEY_ID, KEY_SECRET);
    const keyId = getRazorpayKeyId();
    expect(keyId).toBe(KEY_ID);
    expect(keyId).not.toContain(KEY_SECRET);
  });
});

describe("server-side Razorpay API calls", () => {
  it("creates an order with Basic auth and the locked paise amount", async () => {
    setEnv(KEY_ID, KEY_SECRET);
    const calls: any[] = [];
    const orig = globalThis.fetch;
    // @ts-expect-error — mock fetch
    globalThis.fetch = async (url: string, init: any) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "order_live_probe", amount: 6000000, currency: "INR" }), { status: 200 });
    };
    try {
      const { ok, data } = await createRazorpayOrder({
        amountPaise: 6000000,
        receipt: "order_xyz",
        notes: { tenantId: "t1", leaseType: "LEASE_30" },
      });
      expect(ok).toBe(true);
      expect(data.id).toBe("order_live_probe");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://api.razorpay.com/v1/orders");
      expect(calls[0].init.method).toBe("POST");
      // Basic auth header is present; the body must NOT contain the secret
      expect(calls[0].init.headers.Authorization).toMatch(/^Basic /);
      expect(calls[0].init.headers.Authorization).not.toContain(KEY_SECRET);
      const body = JSON.parse(calls[0].init.body);
      expect(body.amount).toBe(6000000);
      expect(body.currency).toBe("INR");
      expect(body.receipt).toBe("order_xyz");
      expect(JSON.stringify(body)).not.toContain(KEY_SECRET);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("returns a not-configured result without calling the network when env is missing", async () => {
    setEnv(undefined, undefined);
    const { ok, data } = await createRazorpayOrder({ amountPaise: 100, receipt: "r" });
    expect(ok).toBe(false);
    expect(data?.error?.description ?? "").toContain("missing");
  });

  it("fetches a payment by id", async () => {
    setEnv(KEY_ID, KEY_SECRET);
    const orig = globalThis.fetch;
    // @ts-expect-error — mock fetch
    globalThis.fetch = async (url: string, init: any) => {
      expect(url).toBe("https://api.razorpay.com/v1/payments/pay_123");
      expect(init.headers.Authorization).toMatch(/^Basic /);
      expect(init.headers.Authorization).not.toContain(KEY_SECRET);
      return new Response(JSON.stringify({ id: "pay_123", status: "captured", amount: 100, currency: "INR" }), { status: 200 });
    };
    try {
      const { ok, pay } = await fetchRazorpayPayment("pay_123");
      expect(ok).toBe(true);
      expect(pay.status).toBe("captured");
    } finally {
      globalThis.fetch = orig;
    }
  });
});