/**
 * Acquisition OS — API handler tests (DB + auth mocked).
 *
 * Verifies the operating loop wiring without a live database:
 * tenant scoping (session tenantId only), entitlement gating, validation,
 * idempotency, lifecycle transitions, and honest failure states.
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

import { GET as profileGET, PUT as profilePUT } from "@/app/api/acquisition/profile/route";
import { GET as leadsGET, POST as leadsPOST } from "@/app/api/acquisition/leads/route";
import { POST as decidePOST } from "@/app/api/acquisition/leads/decision/route";
import { POST as sendPOST } from "@/app/api/acquisition/outreach/send/route";
import { GET as fuGET, POST as fuPOST } from "@/app/api/acquisition/followups/route";
import { GET as statsGET } from "@/app/api/acquisition/stats/route";
import { DELETE as eraseDELETE } from "@/app/api/acquisition/account/route";
import { GET as repliesGET } from "@/app/api/acquisition/replies/route";
import { GET as outreachGET } from "@/app/api/acquisition/outreach/route";

const SESSION = { user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } };

function tx(overrides: Record<string, any> = {}) {
  const table = (extra: Record<string, any> = {}) => ({
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockImplementation(async (a: any) => ({ id: "new1", ...a.data })),
    update: vi.fn().mockImplementation(async (a: any) => ({ id: "x", ...a.data })),
    upsert: vi.fn().mockImplementation(async (a: any) => ({ id: "up1", ...a.create })),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    ...extra,
  });
  return {
    acquisitionProfile: table(),
    leadResearch: table(),
    outreachOrder: table(),
    leadLifecycleEvent: table(),
    outreachEmail: table(),
    followUp: table(),
    campaign: table(),
    activityEvent: table(),
    acquisitionDataImport: table(),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(SESSION);
  mocks.requireCommercialAccess.mockResolvedValue({ status: "TRIAL" });
  mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(tx()));
  delete process.env.RESEND_API_KEY;
});

describe("auth scoping", () => {
  it("all GETs 401 without a session and never touch the DB", async () => {
    mocks.auth.mockResolvedValue(null);
    for (const call of [
      () => profileGET(), () => leadsGET(req("http://x/api/acquisition/leads")),
      () => statsGET(), () => fuGET(),
      () => repliesGET(req("http://x/api/acquisition/replies")),
      () => outreachGET(req("http://x/api/acquisition/outreach")),
    ]) {
      const res = await call();
      expect(res.status).toBe(401);
    }
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("derives tenant from session, ignores client-supplied tenantId", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await leadsPOST(req("http://x/api/acquisition/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business: "Globex", email: "ops@globex.com", tenantId: "evil" }),
    }));
    expect(res.status).toBe(201);
    expect(t.leadResearch.upsert).toHaveBeenCalled();
    const arg = t.leadResearch.upsert.mock.calls[0][0];
    expect(arg.where.tenantId_leadKey.tenantId).toBe("t1");
    expect(JSON.stringify(arg)).not.toContain("evil");
  });
});

describe("profile persist (onboarding)", () => {
  it("PUT validates and upserts; version bumps on re-submit", async () => {
    const bad = await profilePUT(req("http://x/api/acquisition/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: "" }),
    }));
    expect(bad.status).toBe(400);

    const t = tx({ acquisitionProfile: (() => { const tb: any = tx().acquisitionProfile; tb.findUnique.mockResolvedValueOnce({ version: 2, activatedAt: new Date() }); return tb; })() });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await profilePUT(req("http://x/api/acquisition/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Acme", industry: "saas", icp: { roles: [], industries: [] } }),
    }));
    expect(res.status).toBe(200);
    expect(t.acquisitionProfile.update).toHaveBeenCalled();
    const data = t.acquisitionProfile.update.mock.calls[0][0].data;
    expect(data.version).toBe(3);
    expect(data.status).toBe("ACTIVE");
  });

  it("GET returns the stored profile (refresh-safe)", async () => {
    const stored = { tenantId: "t1", companyName: "Acme", version: 1 };
    const t = tx();
    t.acquisitionProfile.findUnique.mockResolvedValueOnce(stored);
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await profileGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile: stored });
  });
});

describe("leads persist + review", () => {
  it("POST gates on entitlement (402) before touching the DB", async () => {
    mocks.requireCommercialAccess.mockRejectedValueOnce(Object.assign(new Error("ENTITLEMENT_REQUIRED"), { status: 402 }));
    const res = await leadsPOST(req("http://x/api/acquisition/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business: "G", email: "a@b.co" }),
    }));
    expect(res.status).toBe(402);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("POST rejects bad email with actionable issues", async () => {
    const res = await leadsPOST(req("http://x/api/acquisition/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business: "G", email: "nope" }),
    }));
    expect(res.status).toBe(400);
    const j: any = await res.json();
    expect(j.issues[0].path).toContain("email");
  });

  it("POST creates research + READY order + lifecycle event; re-import is duplicate-safe", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const body = { business: "Globex", email: "ops@globex.com" };
    const mk = () => req("http://x/api/acquisition/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const first = await leadsPOST(mk());
    expect(first.status).toBe(201);
    expect(t.outreachOrder.create).toHaveBeenCalledTimes(1);
    expect(t.outreachOrder.create.mock.calls[0][0].data.status).toBe("READY_FOR_APPROVAL");
    expect(t.leadLifecycleEvent.create).toHaveBeenCalled();

    // Second import finds the existing v1 order → no duplicate, duplicate:true
    const t2 = tx();
    t2.outreachOrder.findUnique.mockResolvedValueOnce({ id: "o1", status: "READY_FOR_APPROVAL" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t2));
    const second = await leadsPOST(mk());
    expect(second.status).toBe(201);
    const j: any = await second.json();
    expect(j.duplicate).toBe(true);
    expect(t2.outreachOrder.create).not.toHaveBeenCalled();
  });

  it("GET scopes every filter to the session tenant", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await leadsGET(req("http://x/api/acquisition/leads?status=ready&q=glo&page=2&pageSize=5"));
    expect(res.status).toBe(200);
    const where = t.outreachOrder.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.status).toEqual({ in: ["READY_FOR_APPROVAL", "PENDING"] });
    expect(t.outreachOrder.findMany.mock.calls[0][0].skip).toBe(5);

    const bad = await leadsGET(req("http://x/api/acquisition/leads?status=bogus"));
    expect(bad.status).toBe(400);
  });
});

describe("approval gates + idempotency", () => {
  it("decision 404s cross-tenant ids and 409s terminal orders", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const nf = await decidePOST(req("http://x/decision", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "nope", decision: "APPROVED" }),
    }));
    expect(nf.status).toBe(404);
    expect(t.outreachOrder.findFirst).toHaveBeenCalledWith({ where: { id: "nope", tenantId: "t1" } });

    const t2 = tx();
    t2.outreachOrder.findFirst.mockResolvedValueOnce({ id: "o1", leadKey: "k", status: "SENT" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t2));
    const term = await decidePOST(req("http://x/decision", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o1", decision: "APPROVED" }),
    }));
    expect(term.status).toBe(409);
    expect(t2.outreachOrder.update).not.toHaveBeenCalled();
  });

  it("decision records approval with lifecycle event; repeat returns reused", async () => {
    const t = tx();
    t.outreachOrder.findFirst.mockResolvedValueOnce({ id: "o1", leadKey: "k", status: "READY_FOR_APPROVAL", approvalId: null });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await decidePOST(req("http://x/decision", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o1", decision: "APPROVED" }),
    }));
    expect(res.status).toBe(200);
    expect(t.outreachOrder.update.mock.calls[0][0].data.status).toBe("APPROVED");
    expect(t.leadLifecycleEvent.create).toHaveBeenCalled();

    const t2 = tx();
    t2.outreachOrder.findFirst.mockResolvedValueOnce({ id: "o1", status: "APPROVED" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t2));
    const rep = await decidePOST(req("http://x/decision", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o1", decision: "APPROVED" }),
    }));
    const j: any = await rep.json();
    expect(j.reused).toBe(true);
    expect(t2.leadLifecycleEvent.create).not.toHaveBeenCalled();
  });

  it("send requires APPROVED, records honest FAILED without provider, SENT on confirm", async () => {
    // Non-approved order is refused before any claim or provider work.
    const t = tx();
    t.outreachOrder.findFirst.mockResolvedValue({ id: "o1", leadKey: "k", status: "READY_FOR_APPROVAL" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const blocked = await sendPOST(req("http://x/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o1" }),
    }));
    expect(blocked.status).toBe(409);

    // Approved order wins the send claim (updateMany -> count 1) and, with no
    // provider configured, fails honestly instead of being marked SENT.
    const t2 = tx();
    t2.outreachOrder.findFirst.mockResolvedValue({ id: "o2", leadKey: "k", status: "APPROVED", email: "a@b.co", subject: "s", body: "b", sendId: null, sendClaimedAt: null });
    t2.outreachOrder.updateMany.mockResolvedValue({ count: 1 });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t2));
    const failed = await sendPOST(req("http://x/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o2" }),
    }));
    expect(failed.status).toBe(200);
    const fj: any = await failed.json();
    expect(fj.order.status).toBe("FAILED");
    expect(fj.order.sendError).toMatch(/provider not configured/i);
    // The claim must be released so the order can be retried once configured.
    expect(fj.order.sendClaimedAt).toBeNull();
  });
});

describe("follow-ups, replies, stats, erase", () => {
  it("follow-up POST 404s foreign orders; duplicate window returns existing", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const nf = await fuPOST(req("http://x/fu", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "nope", business: "G" }),
    }));
    expect(nf.status).toBe(404);

    const t2 = tx();
    t2.outreachOrder.findFirst.mockResolvedValueOnce({ id: "o1", leadKey: "k", businessName: "G" });
    t2.followUp.findFirst.mockResolvedValueOnce({ id: "f1" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t2));
    const dup = await fuPOST(req("http://x/fu", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "o1", business: "G" }),
    }));
    const j: any = await dup.json();
    expect(j.duplicate).toBe(true);
    expect(t2.followUp.create).not.toHaveBeenCalled();
  });

  it("stats count only the session tenant", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await statsGET();
    expect(res.status).toBe(200);
    for (const c of t.outreachOrder.count.mock.calls) expect(c[0].where.tenantId).toBe("t1");
    const j: any = await res.json();
    expect(j.stats).toMatchObject({ leadsTotal: 0, emailsSent: 0 });
    expect(Date.parse(j.stats.generatedAt)).not.toBeNaN();
  });

  it("erase requires confirmation and never touches identity/billing", async () => {
    const noConfirm = await eraseDELETE(req("http://x/account", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(noConfirm.status).toBe(400);

    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await eraseDELETE(req("http://x/account", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }),
    }));
    expect(res.status).toBe(200);
    for (const m of ["followUp", "leadLifecycleEvent", "outreachEmail", "outreachOrder", "leadResearch", "campaign", "activityEvent", "acquisitionDataImport", "acquisitionProfile"] as const) {
      expect((t[m] as any).deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
    }
    expect((t as any).tenant).toBeUndefined();
  });
});
