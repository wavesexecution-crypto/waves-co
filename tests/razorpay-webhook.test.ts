/**
 * Razorpay server-side reconciliation tests.
 *
 * Covers the failure this route exists to eliminate:
 *   customer pays â†’ closes the browser â†’ money taken, lease never activates.
 * The webhook must recover that, must not activate twice, and must never trust
 * the payload it is verifying.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

import {
  extractPaymentFacts,
  isHandledEvent,
  isWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/razorpay-webhook";

const SECRET = "whsec_test_secret_value_123456";

const mocks = vi.hoisted(() => ({ tx: null as any, auth: vi.fn() }));
vi.mock("@/lib/context", () => ({ withTenantContext: vi.fn() }));

import { withTenantContext } from "@/lib/context";
import { POST as webhookPOST } from "@/app/api/billing/razorpay/webhook/route";

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function makeReq(body: string, signature: string | null) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature) headers.set("x-razorpay-signature", signature);
  return new Request("https://app.wavesco.in/api/billing/razorpay/webhook", {
    method: "POST",
    headers,
    body,
  });
}

/** Minimal in-memory stand-in for the tenant-scoped Prisma transaction. */
function fakeTx(order: any) {
  const state = { order: { ...order }, entitlement: null as any, audits: [] as any[], lifecycle: [] as any[] };
  const tx: any = {
    acquisitionOrder: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.providerOrderId) {
          return state.order?.providerOrderId === where.providerOrderId ? { ...state.order } : null;
        }
        return null;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        // Mirrors the atomic claim: only matches while paymentId is still NULL.
        if (where.paymentId !== null) return { count: 0 };
        if (state.order.paymentId !== null) return { count: 0 };
        state.order = { ...state.order, ...data };
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: any) => {
        state.order = { ...state.order, ...data };
        return { ...state.order };
      }),
    },
    acquisitionEntitlement: {
      findUnique: vi.fn(async () => (state.entitlement ? { ...state.entitlement } : null)),
      updateMany: vi.fn(async ({ data }: any) => {
        if (state.entitlement) state.entitlement = { ...state.entitlement, ...data };
        return { count: state.entitlement ? 1 : 0 };
      }),
      upsert: vi.fn(async ({ create, update }: any) => {
        state.entitlement = { id: "ent1", ...(state.entitlement ?? {}), ...create, ...update };
        return state.entitlement;
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => { state.audits.push(data); return data; }) },
    leadLifecycleEvent: { create: vi.fn(async ({ data }: any) => { state.lifecycle.push(data); return data; }) },
  };
  return { tx, state };
}

const CAPTURED_EVENT = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_123",
        order_id: "order_123",
        amount: 6000000,
        currency: "INR",
        status: "captured",
      },
    },
    order: { entity: { id: "order_123", notes: { tenantId: "tenant_abc", leaseType: "LEASE_30" } } },
  },
};

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

describe("webhook signature verification", () => {
  it("accepts a body signed with the webhook secret", () => {
    const body = JSON.stringify(CAPTURED_EVENT);
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify(CAPTURED_EVENT);
    const signature = sign(body);
    const tampered = body.replace("6000000", "1");
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const body = JSON.stringify(CAPTURED_EVENT);
    expect(verifyWebhookSignature(body, sign(body, "other_secret"))).toBe(false);
  });

  it("rejects when unconfigured or signature missing â€” never throws", () => {
    const body = "{}";
    expect(verifyWebhookSignature(body, null)).toBe(false);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature(body, sign(body))).toBe(false);
    expect(isWebhookConfigured()).toBe(false);
  });
});

describe("webhook event handling", () => {
  it("only handles payment lifecycle events that can change access", () => {
    expect(isHandledEvent("payment.captured")).toBe(true);
    expect(isHandledEvent("payment.failed")).toBe(true);
    expect(isHandledEvent("refund.processed")).toBe(true);
    expect(isHandledEvent("payment.authorized")).toBe(false);
    expect(isHandledEvent("subscription.charged")).toBe(false);
  });

  it("extracts facts, and returns null for malformed payloads", () => {
    expect(extractPaymentFacts(CAPTURED_EVENT as any)).toMatchObject({
      paymentId: "pay_123",
      orderId: "order_123",
      amountPaise: 6000000,
      currency: "INR",
      status: "captured",
    });
    expect(extractPaymentFacts({ event: "payment.captured", payload: {} } as any)).toBeNull();
  });

  it("recovers an abandoned-browser payment (no callback ever ran)", async () => {
    const { tx, state } = fakeTx({
      id: "ord_1",
      providerOrderId: "order_123",
      tenantId: "tenant_abc",
      leaseType: "LEASE_30",
      amountPaise: 6000000,
      currency: "INR",
      status: "PAYMENT_PENDING",
      paymentId: null,
    });
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(tx));

    const body = JSON.stringify(CAPTURED_EVENT);
    const res = await webhookPOST(makeReq(body, sign(body)));

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.activated).toBe(true);
    expect(state.entitlement.status).toBe("ACTIVE");
    expect(state.entitlement.leaseType).toBe("LEASE_30");
    // 30 days from activation
    const days = (new Date(state.entitlement.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("is idempotent: duplicate webhook does NOT extend the lease twice", async () => {
    const { tx, state } = fakeTx({
      id: "ord_1", providerOrderId: "order_123", tenantId: "tenant_abc", leaseType: "LEASE_30", amountPaise: 6000000,
      currency: "INR", status: "PAYMENT_PENDING", paymentId: null,
    });
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(tx));

    const body = JSON.stringify(CAPTURED_EVENT);
    await webhookPOST(makeReq(body, sign(body)));
    const firstExpiry = state.entitlement.expiresAt;

    const second = await webhookPOST(makeReq(body, sign(body)));
    const json: any = await second.json();

    expect(second.status).toBe(200);
    expect(json.activated).toBe(false);
    expect(state.entitlement.expiresAt).toBe(firstExpiry);
  });

  it("rejects an invalid signature without touching state", async () => {
    const { tx, state } = fakeTx({
      id: "ord_1", providerOrderId: "order_123", tenantId: "tenant_abc", leaseType: "LEASE_30", amountPaise: 6000000,
      currency: "INR", status: "PAYMENT_PENDING", paymentId: null,
    });
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(tx));

    const body = JSON.stringify(CAPTURED_EVENT);
    const res = await webhookPOST(makeReq(body, "deadbeef"));

    expect(res.status).toBe(401);
    expect(state.entitlement).toBeNull();
    expect(state.order.status).toBe("PAYMENT_PENDING");
  });

  it("rejects a tampered amount and refuses to activate", async () => {
    const { tx, state } = fakeTx({
      id: "ord_1", providerOrderId: "order_123", tenantId: "tenant_abc", leaseType: "LEASE_30", amountPaise: 6000000,
      currency: "INR", status: "PAYMENT_PENDING", paymentId: null,
    });
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(tx));

    const tampered = JSON.parse(JSON.stringify(CAPTURED_EVENT));
    tampered.payload.payment.entity.amount = 1; // client tries to buy 30 days for â‚¹0.01
    const body = JSON.stringify(tampered);
    const res = await webhookPOST(makeReq(body, sign(body)));

    expect(res.status).toBe(400);
    expect(state.entitlement).toBeNull();
  });

  it("refuses an order belonging to a different tenant than the notes claim", async () => {
    const { tx, state } = fakeTx({
      id: "ord_1", providerOrderId: "order_123", tenantId: "tenant_OTHER", leaseType: "LEASE_30", amountPaise: 6000000,
      currency: "INR", status: "PAYMENT_PENDING", paymentId: null,
    });
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(tx));

    const body = JSON.stringify(CAPTURED_EVENT);
    const res = await webhookPOST(makeReq(body, sign(body)));

    expect(res.status).toBe(404);
    expect(state.entitlement).toBeNull();
  });

  it("acks unhandled events so the provider stops retrying", async () => {
    const body = JSON.stringify({ event: "payment.authorized", payload: {} });
    const res = await webhookPOST(makeReq(body, sign(body)));
    expect(res.status).toBe(200);
    expect((await res.json()).handled).toBe(false);
  });
});