/**
 * Queue drain + sending providers.
 * Drain executes APPROVED orders through the shared atomic pipeline,
 * bounded per call, with session or service-secret auth. Provider crypto
 * round-trips; connect validates live (mocked transport here).
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

import { POST as drainPOST } from "@/app/api/acquisition/outreach/drain/route";
import { GET as providerGET, POST as providerPOST } from "@/app/api/acquisition/sending/provider/route";
import { encryptApiKey, decryptApiKey } from "@/lib/email-provider";
import { assignVariant } from "@/lib/outreach-send";

const SESSION = { user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } };

function table(extra: Record<string, any> = {}) {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockImplementation(async (a: any) => ({ id: "new1", createdAt: new Date(), ...a.data })),
    update: vi.fn().mockImplementation(async (a: any) => ({ id: "x", ...a.data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    upsert: vi.fn().mockImplementation(async (a: any) => ({ id: "up1", ...a.create })),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...extra,
  };
}

function tx(overrides: Record<string, any> = {}) {
  return {
    acquisitionCycle: table(),
    outreachOrder: table(),
    leadLifecycleEvent: table(),
    messageTemplate: table(),
    emailCredential: table(),
    integrationStatus: table(),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function req(url: string, body?: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(SESSION);
  mocks.requireCommercialAccess.mockResolvedValue({ status: "TRIAL" });
  mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(tx()));
  delete process.env.RESEND_API_KEY;
  delete process.env.N8N_WEBHOOK_SECRET;
  delete process.env.N8N_BASE_URL;
});

describe("drain auth", () => {
  it("401 without session and without service secret", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await drainPOST(req("http://x/drain", {}));
    expect(res.status).toBe(401);
  });

  it("service secret + explicit tenantId drains without a session", async () => {
    process.env.N8N_WEBHOOK_SECRET = "svc-secret";
    mocks.auth.mockResolvedValue(null);
    const t = tx();
    t.outreachOrder.findMany.mockResolvedValue([]);
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await drainPOST(req("http://x/drain", { tenantId: "t9" }, { "x-waves-service": "svc-secret" }));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.attempted).toBe(0);
  });

  it("wrong service secret is rejected", async () => {
    process.env.N8N_WEBHOOK_SECRET = "svc-secret";
    mocks.auth.mockResolvedValue(null);
    const res = await drainPOST(req("http://x/drain", { tenantId: "t9" }, { "x-waves-service": "wrong" }));
    expect(res.status).toBe(401);
  });
});

describe("drain execution", () => {
  it("processes queued APPROVED orders with per-order outcomes, bounded", async () => {
    const t = tx();
    const rows = [{ id: "o1" }, { id: "o2" }];
    t.outreachOrder.findMany.mockResolvedValue(rows);
    // o1: claimable + provider missing -> FAILED honestly; o2: already sent -> reused.
    t.outreachOrder.findFirst
      .mockResolvedValueOnce({ id: "o1", tenantId: "t1", leadKey: "k1", email: "a@x.co", subject: "s", body: "b", status: "APPROVED", sendId: null, sendClaimedAt: null, cycleId: null })
      .mockResolvedValueOnce({ id: "o2", tenantId: "t1", sendId: "send_old", status: "SENT" });
    t.outreachOrder.updateMany.mockResolvedValue({ count: 1 });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await drainPOST(req("http://x/drain", { limit: 10 }));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.attempted).toBe(2);
    expect(j.results.find((r: any) => r.orderId === "o1").outcome).toBe("failed");
    expect(j.results.find((r: any) => r.orderId === "o2").outcome).toBe("reused");
  });

  it("cycle-scoped drain 404s on foreign cycles", async () => {
    const res = await drainPOST(req("http://x/drain", { cycleId: "foreign" }));
    expect(res.status).toBe(404);
  });
});

describe("provider crypto + connect", () => {
  it("AES-GCM round-trips and never stores plaintext", async () => {
    process.env.AUTH_SECRET = "test-auth-secret-for-unit-tests-only";
    const { cipher, iv } = encryptApiKey("re_testkey123456");
    expect(cipher).not.toContain("re_testkey123456");
    expect(decryptApiKey(cipher, iv)).toBe("re_testkey123456");
    delete process.env.AUTH_SECRET;
  });

  it("variant assignment is deterministic and stable per order", () => {
    expect(assignVariant("o1", [{ label: "A" }, { label: "B" }])).toBe(assignVariant("o1", [{ label: "A" }, { label: "B" }]));
    expect(assignVariant("o1", [])).toBe("default");
  });

  it("disconnect clears the credential; select requires a verified key", async () => {
    const t = tx();
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const disc = await providerPOST(req("http://x/provider", { action: "disconnect" }));
    expect(disc.status).toBe(200);
    expect(t.emailCredential.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
    const sel = await providerPOST(req("http://x/provider", { action: "select", provider: "custom" }));
    expect(sel.status).toBe(409);
  });

  it("provider GET reports honest readiness without leaking keys", async () => {
    const res = await providerGET();
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.waves.available).toBe(false);
    expect(j.custom.connected).toBe(false);
    expect(JSON.stringify(j)).not.toMatch(/re_/);
  });
});
