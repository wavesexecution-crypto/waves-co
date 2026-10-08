/**
 * Step 5 — reply intelligence: record (upsert per order), manual fields,
 * direction persistence, takeover bundle, cross-tenant isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  withTenantContext: vi.fn(),
  requireCommercialAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/context", () => ({ withTenantContext: mocks.withTenantContext }));
vi.mock("@/lib/billing", () => ({ requireCommercialAccess: mocks.requireCommercialAccess }));

import { GET as listGET, POST as recordPOST } from "@/app/api/acquisition/reply-reports/route";
import { POST as directionPOST } from "@/app/api/acquisition/reply-reports/[id]/direction/route";
import { POST as takeoverPOST } from "@/app/api/acquisition/reply-reports/[id]/takeover/route";

const SESSION = { user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } };

function table(extra: Record<string, any> = {}) {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (a: any) => ({ id: "new1", createdAt: new Date(), ...a.data })),
    update: vi.fn().mockImplementation(async (a: any) => ({ id: "x", ...a.data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...extra,
  };
}

function tx(overrides: Record<string, any> = {}) {
  return {
    outreachOrder: table(),
    replyReport: table(),
    replyDirection: table(),
    leadLifecycleEvent: table(),
    aiJob: table(),
    clientAiConfig: table(),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(SESSION);
  mocks.requireCommercialAccess.mockResolvedValue({ status: "TRIAL" });
  mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(tx()));
});

describe("reply recording", () => {
  it("upserts one live report per order (second record updates, no duplicate)", async () => {
    const t = tx();
    t.outreachOrder.findFirst.mockResolvedValue({ id: "o1", tenantId: "t1", leadKey: "k", contactName: "Pat", businessName: "Globex", subject: "s", body: "b", cycleId: "c1" });
    t.replyReport.findUnique.mockResolvedValue(null);
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const first = await recordPOST(req("http://x/", { orderId: "o1", replyText: "Sounds interesting, what does it cost?", classify: false }));
    expect(first.status).toBe(201);
    expect(t.replyReport.create).toHaveBeenCalledTimes(1);

    const t2 = tx();
    t2.outreachOrder.findFirst.mockResolvedValue({ id: "o1", tenantId: "t1", leadKey: "k", contactName: "Pat", businessName: "Globex", subject: "s", body: "b", cycleId: "c1" });
    t2.replyReport.findUnique.mockResolvedValue({ id: "r1", orderId: "o1" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t2));
    const second = await recordPOST(req("http://x/", { orderId: "o1", replyText: "Following up with a question.", classify: false }));
    expect(second.status).toBe(201);
    expect(t2.replyReport.create).not.toHaveBeenCalled();
    expect(t2.replyReport.update).toHaveBeenCalled();
  });

  it("manual classification stores fields with source manual", async () => {
    const t = tx();
    t.outreachOrder.findFirst.mockResolvedValue({ id: "o1", tenantId: "t1", leadKey: "k", businessName: "G", subject: "s", body: "b" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await recordPOST(req("http://x/", {
      orderId: "o1", replyStatus: "INTERESTED", intent: "High", summary: "Asked for pricing and a call next week.",
    }));
    expect(res.status).toBe(201);
    const data = t.replyReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ replyStatus: "INTERESTED", intent: "High", source: "manual" });
  });

  it("foreign orders 404 (cross-tenant write impossible)", async () => {
    const res = await recordPOST(req("http://x/", { orderId: "foreign", replyText: "hi" }));
    expect(res.status).toBe(404);
  });

  it("list is tenant-scoped", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await listGET(req("http://x/"));
    expect(res.status).toBe(200);
    expect(t.replyReport.findMany.mock.calls[0][0].where.tenantId).toBe("t1");
  });
});

describe("direction + takeover", () => {
  function reportTx() {
    const t = tx();
    t.replyReport.findFirst.mockResolvedValue({
      id: "r1", orderId: "o1", tenantId: "t1", replyStatus: "INTERESTED",
      directions: [],
    });
    return t;
  }

  it("direction persists instruction and queues a draft job", async () => {
    const t = reportTx();
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await directionPOST(req("http://x/", { kind: "book", customText: null }), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(201);
    const data = t.replyDirection.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ kind: "book", status: "pending", tenantId: "t1" });
    const j: any = await res.json();
    expect(j.draftJob.operation).toBe("REPLY_DIRECTION");
  });

  it("custom direction requires customText", async () => {
    const res = await directionPOST(req("http://x/", { kind: "custom" }), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(400);
  });

  it("takeover records control mode and returns the conversation bundle", async () => {
    const t = reportTx();
    // Production update() returns the full row; mirror that here.
    t.replyReport.update.mockImplementation(async (a: any) => ({
      id: "r1", orderId: "o1", tenantId: "t1", replyStatus: "INTERESTED",
      intent: "High", sentiment: "Positive", ...a.data,
    }));
    t.outreachOrder.findFirst.mockResolvedValue({ id: "o1", subject: "Ideas", body: "Hello", sentAt: new Date() });
    t.leadLifecycleEvent.findMany.mockResolvedValue([{ stage: "send", status: "SENT" }]);
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await takeoverPOST(req("http://x/", {}), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.report.takenOverAt ?? j.conversation).toBeTruthy();
    expect(j.conversation.originalMessage.subject).toBe("Ideas");
    expect(j.conversation.intelligence.replyStatus).toBe("INTERESTED");
    expect(t.replyDirection.create.mock.calls[0][0].data.kind).toBe("takeover");
  });

  it("takeover of a foreign report 404s", async () => {
    const res = await takeoverPOST(req("http://x/", {}), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});
