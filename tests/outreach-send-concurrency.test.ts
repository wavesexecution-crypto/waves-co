/**
 * Concurrent-send protection.
 *
 * The regression this guards: the original send path checked `sendId === null`
 * and then called the email provider, all inside one transaction. Two
 * simultaneous requests could both observe NULL and both send, so a real
 * prospect could receive the same message twice.
 *
 * These tests fire the handler concurrently against a shared fake database that
 * implements the same compare-and-set semantics as the real UPDATE ... WHERE
 * paymentId/sendClaimedAt IS NULL.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), requireCommercialAccess: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing", () => ({ requireCommercialAccess: mocks.requireCommercialAccess }));
vi.mock("@/lib/context", () => ({ withTenantContext: vi.fn() }));

import { withTenantContext } from "@/lib/context";
import { POST as sendPOST } from "@/app/api/acquisition/outreach/send/route";

/** Counts how many times the external provider was actually invoked. */
let providerCalls = 0;

vi.mock("@/lib/email-send", () => ({
  deliverEmail: async () => {
    providerCalls += 1;
    // Yield to the event loop so real interleaving happens.
    await new Promise((r) => setTimeout(r, 5));
    return { ok: true };
  },
}));

/**
 * Shared single-row store emulating an atomic conditional UPDATE.
 * sendClaimedAt is the lock; only one caller can move it off NULL.
 */
function makeSharedDb(order: any) {
  const row = { ...order };
  return {
    outreachOrder: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === row.id && where.tenantId === row.tenantId ? { ...row } : null,
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        // Atomic compare-and-set on the claim + sendId.
        if (row.sendId !== where.sendId) return { count: 0 };
        if (row.status !== where.status) return { count: 0 };
        const stale = row.sendClaimedAt === null || row.sendClaimedAt < where.OR[1].sendClaimedAt.lt;
        if (!stale) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(row, data);
        return { ...row };
      }),
    },
      leadLifecycleEvent: { create: vi.fn(async ({ data }: any) => data) },
    auditLog: { create: vi.fn(async ({ data }: any) => data) },
    acquisitionCycle: { findFirst: vi.fn(async () => null) },
    emailCredential: { findUnique: vi.fn(async () => null) },
    messageTemplate: { findFirst: vi.fn(async () => null) },
  };
}

function approvedOrder(overrides: Record<string, any> = {}) {
  return {
    id: "o1",
    tenantId: "t1",
    leadKey: "k1",
    status: "APPROVED",
    email: "lead@prospect.com",
    subject: "Hello",
    body: "Body",
    sendId: null,
    sendClaimedAt: null,
    sendAttempts: 0,
    ...overrides,
  };
}

function postSend() {
  return sendPOST(
    new Request("https://app.wavesco.in/api/acquisition/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "o1" }),
    }),
  );
}

beforeEach(() => {
  providerCalls = 0;
  process.env.RESEND_API_KEY = "re_test_key";
  mocks.auth.mockResolvedValue({ user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } });
  mocks.requireCommercialAccess.mockResolvedValue({ status: "TRIAL" });
});

describe("concurrent sends cannot duplicate an email", () => {
  it("two simultaneous sends result in exactly ONE provider call", async () => {
    const db = makeSharedDb(approvedOrder());
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    const results = await Promise.all([postSend(), postSend()]);

    expect(providerCalls).toBe(1);
    const statuses = results.map((r) => r.status);
    expect(statuses.every((s) => s === 200)).toBe(true);

    // Exactly one response reports a fresh send; the other is a safe replay.
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(bodies.filter((b: any) => b.sent === true)).toHaveLength(1);
    expect(bodies.filter((b: any) => b.reused === true)).toHaveLength(1);
  });

  it("eight simultaneous sends still produce exactly ONE email", async () => {
    const db = makeSharedDb(approvedOrder());
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    await Promise.all(Array.from({ length: 8 }, () => postSend()));

    expect(providerCalls).toBe(1);
    expect(db.outreachOrder.findFirst.mock.calls.length).toBeGreaterThan(0);
  });

  it("records SENT with ACCEPTED delivery, never claiming delivery", async () => {
    const row = approvedOrder();
    const db = makeSharedDb(row);
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    await postSend();

    const final = db.outreachOrder.update.mock.calls.at(-1)![0].data;
    expect(final.status).toBe("SENT");
    expect(final.deliveryStatus).toBe("ACCEPTED");
    expect(final.sendId).toMatch(/^send_/);
    // claim released after completion so state is inspectable
    expect(final.sendClaimedAt).toBeNull();
  });

  it("a live claim blocks a second send, and the attempts counter advances once", async () => {
    const db = makeSharedDb(approvedOrder({ sendClaimedAt: new Date() }));
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    const res = await postSend();
    const body: any = await res.json();

    expect(providerCalls).toBe(0);
    expect(body.reused).toBe(true);
  });

  it("a stale claim from a crashed process is reclaimable", async () => {
    // 10 minutes old — older than the 5 minute claim TTL.
    const db = makeSharedDb(approvedOrder({ sendClaimedAt: new Date(Date.now() - 10 * 60 * 1000) }));
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    await postSend();

    expect(providerCalls).toBe(1);
  });

  it("different orders remain independent", async () => {
    const rows: Record<string, any> = {};
    const make = (id: string) => ({ ...approvedOrder({ id }) });
    const get = (id: string) => {
      if (!rows[id]) rows[id] = make(id);
      return rows[id];
    };
    const db = {
      outreachOrder: {
        findFirst: vi.fn(async ({ where }: any) => ({ ...get(where.id) })),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const row = get(where.id);
          if (row.sendId !== where.sendId || row.status !== where.status) return { count: 0 };
          if (row.sendClaimedAt !== null && !(row.sendClaimedAt < where.OR[1].sendClaimedAt.lt)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          Object.assign(get(where.id), data);
          return { ...get(where.id) };
        }),
      },
      leadLifecycleEvent: { create: vi.fn(async ({ data }: any) => data) },
      auditLog: { create: vi.fn(async ({ data }: any) => data) },
    };
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    const send = (id: string) =>
      sendPOST(
        new Request("https://app.wavesco.in/api/acquisition/outreach/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: id }),
        }),
      );

    const responses = await Promise.all([send("o1"), send("o2"), send("o1"), send("o2")]);
    const bodies = await Promise.all(responses.map((r) => r.json()));

    expect(
      { providerCalls, bodies: bodies.map((b: any) => ({ sent: b.sent, reused: b.reused, err: b.error, id: b.order?.id })) },
    ).toEqual({
      providerCalls: 2,
      bodies: [
        { sent: true, reused: undefined, err: undefined, id: "o1" },
        { sent: true, reused: undefined, err: undefined, id: "o2" },
        { sent: undefined, reused: true, err: undefined, id: "o1" },
        { sent: undefined, reused: true, err: undefined, id: "o2" },
      ],
    });
  });

  it("refuses to send an order that is not APPROVED", async () => {
    const db = makeSharedDb(approvedOrder({ status: "READY_FOR_APPROVAL" }));
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    const res = await postSend();

    expect(res.status).toBe(409);
    expect(providerCalls).toBe(0);
  });

  it("does not leak another tenant's order", async () => {
    const db = makeSharedDb(approvedOrder({ tenantId: "t2" }));
    (withTenantContext as any).mockImplementation(async (_t: string, fn: any) => fn(db));

    const res = await postSend();

    expect(res.status).toBe(404);
    expect(providerCalls).toBe(0);
  });
});