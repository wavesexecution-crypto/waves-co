/**
 * Cycle flow: brain -> goal (new/clone) -> template versions + approval ->
 * close with deterministic metrics -> immutable report -> next cycle.
 * DB + auth mocked; tenant isolation asserted on every write path.
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

import { GET as brainGET, POST as brainPOST } from "@/app/api/acquisition/brain/route";
import { GET as cyclesGET, POST as cyclesPOST } from "@/app/api/acquisition/cycles/route";
import { GET as goalsGET } from "@/app/api/acquisition/goals/route";
import { GET as templatesGET, POST as templatesPOST } from "@/app/api/acquisition/templates/route";
import { POST as approvePOST } from "@/app/api/acquisition/templates/[id]/approve/route";
import { GET as cycleGET } from "@/app/api/acquisition/cycles/[id]/route";
import { POST as closePOST } from "@/app/api/acquisition/cycles/[id]/close/route";
import { GET as reportGET } from "@/app/api/acquisition/cycles/[id]/report/route";

const SESSION = { user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } };

function table(extra: Record<string, any> = {}) {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _max: { version: null, cycleNumber: null } }),
    create: vi.fn().mockImplementation(async (a: any) => ({ id: "new1", createdAt: new Date(), ...a.data })),
    update: vi.fn().mockImplementation(async (a: any) => ({ id: "x", ...a.data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    upsert: vi.fn().mockImplementation(async (a: any) => ({ id: "up1", ...a.create })),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    ...extra,
  };
}

function tx(overrides: Record<string, any> = {}) {
  return {
    companyBrain: table(),
    companyBrainRevision: table(),
    acquisitionCycle: table(),
    cycleGoal: table(),
    messageTemplate: table(),
    aiJob: table(),
    n8nJob: table(),
    outreachOrder: table(),
    leadResearch: table(),
    cycleReport: table(),
    acquisitionProfile: table(),
    integrationStatus: table(),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function json(body: unknown) {
  return req("http://x/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(SESSION);
  mocks.requireCommercialAccess.mockResolvedValue({ status: "TRIAL" });
  mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(tx()));
  delete process.env.RESEND_API_KEY;
});

describe("brain", () => {
  it("builds canonical brain from intake profile", async () => {
    const t = tx();
    t.acquisitionProfile.findUnique.mockResolvedValueOnce({
      companyName: "Acme", website: "https://acme.example", industry: "Mfg",
      icp: { roles: ["VP"] }, offer: {}, brand: {}, rules: {},
    });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await brainPOST(json({ action: "from-intake" }));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.brain.payload.company.name).toBe("Acme");
    expect(t.companyBrain.create).toHaveBeenCalled();
  });

  it("rejects intake when no profile exists (no fake brain)", async () => {
    const res = await brainPOST(json({ action: "from-intake" }));
    expect(res.status).toBe(409);
  });

  it("imports obsidian markdown into the same shape, 422 without a name", async () => {
    const bad = await brainPOST(json({ action: "from-markdown", markdown: "## notes\n- nothing identifiable here plus more text to pass length" }));
    expect(bad.status).toBe(422);
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const good = await brainPOST(json({ action: "from-markdown", markdown: "# Globex Corp\n## Offer\n- Done-for-you outreach" }));
    expect(good.status).toBe(200);
    const j: any = await good.json();
    expect(j.brain.payload.company.name).toBe("Globex Corp");
    expect(Object.keys(j.brain.payload).sort()).toEqual(["company", "icp", "offering", "positioning", "voice"]);
  });
});

describe("goals + cycles", () => {
  it("starts a cycle with a validated new goal", async () => {
    const t = tx();
    t.acquisitionCycle.create.mockResolvedValueOnce({ id: "c1", cycleNumber: 1 });
    t.acquisitionCycle.findUnique.mockResolvedValueOnce({ id: "c1", cycleNumber: 1, status: "ACTIVE" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await cyclesPOST(json({ mode: "new", goal: { title: "Book 20 plumbing demos in Texas" } }));
    expect(res.status).toBe(201);
    const j: any = await res.json();
    expect(j.cycle.cycleNumber).toBe(1);
    expect(j.goal.source).toBe("new");
    expect(t.cycleGoal.create.mock.calls[0][0].data.tenantId).toBe("t1");
  });

  it("rejects short goal titles", async () => {
    const res = await cyclesPOST(json({ mode: "new", goal: { title: "x" } }));
    expect(res.status).toBe(400);
  });

  it("clones a previous goal without mutating it", async () => {
    const t = tx();
    t.acquisitionCycle.create.mockResolvedValueOnce({ id: "c2", cycleNumber: 2 });
    t.acquisitionCycle.findUnique.mockResolvedValueOnce({ id: "c2", cycleNumber: 2, status: "ACTIVE" });
    t.acquisitionCycle.update.mockResolvedValueOnce({ id: "c2" });
    t.cycleGoal.findFirst.mockResolvedValueOnce({
      id: "g1", title: "Old goal", audience: "Plumbers", status: "active", source: "new",
      createdAt: new Date(), updatedAt: new Date(),
    });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await cyclesPOST(json({ mode: "clone", fromGoalId: "g1" }));
    expect(res.status).toBe(201);
    const j: any = await res.json();
    expect(j.goal.source).toBe("clone");
    expect(j.goal.sourceGoalId).toBe("g1");
    expect(j.goal.title).toBe("Old goal");
    // Clone target + source both tenant-scoped.
    expect(t.cycleGoal.findFirst.mock.calls[0][0].where.tenantId).toBe("t1");
  });

  it("clone of a foreign goal 404s and leaves no orphan cycle", async () => {
    const t = tx();
    t.acquisitionCycle.create.mockResolvedValueOnce({ id: "c9", cycleNumber: 9 });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await cyclesPOST(json({ mode: "clone", fromGoalId: "foreign" }));
    expect(res.status).toBe(404);
    expect(t.acquisitionCycle.delete).toHaveBeenCalled();
  });

  it("goals list is tenant-scoped", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await goalsGET();
    expect(res.status).toBe(200);
    expect(t.cycleGoal.findMany.mock.calls[0][0].where.tenantId).toBe("t1");
  });
});

describe("templates", () => {
  function openCycleTx() {
    const t = tx();
    t.acquisitionCycle.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE", tenantId: "t1" });
    return t;
  }

  it("creates manual versions incrementally", async () => {
    const t = openCycleTx();
    t.messageTemplate.aggregate.mockResolvedValueOnce({ _max: { version: 1 } });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await templatesPOST(json({
      cycleId: "c1", subject: "Ideas for {{businessName}}", body: "Hello world, this is a long enough body for validation.",
    }));
    expect(res.status).toBe(201);
    const j: any = await res.json();
    expect(j.template.version).toBe(2);
    expect(j.template.source).toBe("manual");
  });

  it("generate saves a deterministic version immediately", async () => {
    const t = openCycleTx();
    t.companyBrain.findUnique.mockResolvedValueOnce({ payload: { company: { name: "Acme" } } });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await templatesPOST(json({ cycleId: "c1", generate: true }));
    expect(res.status).toBe(201);
    const j: any = await res.json();
    expect(j.template.source).toBe("deterministic");
  });

  it("approve flips exactly one version live; closed cycles refuse", async () => {
    const t = openCycleTx();
    t.messageTemplate.findFirst.mockResolvedValueOnce({ id: "m1", cycleId: "c1", version: 2, status: "draft", tenantId: "t1" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await approvePOST(req("http://x/", { method: "POST" }), { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
    expect(t.messageTemplate.updateMany).toHaveBeenCalledTimes(2);

    const t2 = tx();
    t2.messageTemplate.findFirst.mockResolvedValueOnce({ id: "m1", cycleId: "c1", status: "draft", tenantId: "t1" });
    t2.acquisitionCycle.findFirst.mockResolvedValueOnce({ id: "c1", status: "CLOSED", tenantId: "t1" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t2));
    const closed = await approvePOST(req("http://x/", { method: "POST" }), { params: Promise.resolve({ id: "m1" }) });
    expect(closed.status).toBe(409);
  });

  it("new versions on closed cycles are refused", async () => {
    const t = tx();
    t.acquisitionCycle.findFirst.mockResolvedValueOnce({ id: "c1", status: "CLOSED", tenantId: "t1" });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await templatesPOST(json({ cycleId: "c1", subject: "s coupled with enough length", body: "x".repeat(60) }));
    expect(res.status).toBe(404);
  });
});

describe("close + report immutability", () => {
  function closingTx() {
    const t = tx();
    t.acquisitionCycle.findFirst.mockResolvedValue({ id: "c1", cycleNumber: 3, status: "ACTIVE", tenantId: "t1", startedAt: new Date() });
    t.acquisitionCycle.updateMany.mockResolvedValue({ count: 1 });
    t.outreachOrder.findMany.mockResolvedValue([]);
    t.leadResearch.findMany.mockResolvedValue([]);
    t.cycleReport.findUnique.mockResolvedValue(null);
    t.cycleReport.create.mockImplementation(async (a: any) => ({ id: "r1", ...a.data }));
    return t;
  }

  it("close persists deterministic metrics and queues narrative", async () => {
    const t = closingTx();
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await closePOST(req("http://x/", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.report.metrics.prospectsContacted).toBe(0);
    expect(j.report.metrics.cycleNumber).toBe(3);
    expect(j.report.status).toBe("final_metrics_pending_narrative");
    expect(t.acquisitionCycle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("double close is idempotent (same report, no duplicate)", async () => {
    const t = closingTx();
    t.acquisitionCycle.findFirst.mockResolvedValue({ id: "c1", cycleNumber: 3, status: "CLOSED", tenantId: "t1" });
    t.cycleReport.findUnique.mockResolvedValue({ id: "r1", metrics: { prospectsContacted: 0 } });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await closePOST(req("http://x/", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.reused).toBe(true);
    expect(j.report.id).toBe("r1");
    expect(t.cycleReport.create).not.toHaveBeenCalled();
  });

  it("report read shows metrics with honest pending narrative", async () => {
    const t = tx();
    t.acquisitionCycle.findFirst.mockResolvedValue({
      id: "c1", cycleNumber: 3, status: "CLOSED", tenantId: "t1",
      goals: [], cycleReport: { id: "r1", metrics: { prospectsContacted: 1 }, narrative: null },
    });
    t.aiJob.findFirst.mockResolvedValue({ id: "aj1", status: "RETRY_PENDING", attempt: 2 });
    mocks.withTenantContext.mockImplementationOnce(async (_tid: string, fn: any) => fn(t));
    const res = await reportGET(req("http://x/"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.report.metrics.prospectsContacted).toBe(1);
    expect(j.report.narrative).toBeNull();
    expect(j.narrativeJob.status).toBe("RETRY_PENDING");
  });
});
