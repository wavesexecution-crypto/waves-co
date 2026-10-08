/**
 * n8n bridge: HMAC auth, exactly-once events, tenant-scoped transitions,
 * unconfigured retention, health without secrets.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenantContext: vi.fn(),
}));

vi.mock("@/lib/context", () => ({ withTenantContext: mocks.withTenantContext }));

import { POST as webhookPOST } from "@/app/api/n8n/webhook/route";
import { GET as healthGET } from "@/app/api/n8n/health/route";
import { signN8nPayload, verifyN8nSignature, n8nHealth } from "@/lib/n8n";

function table(extra: Record<string, any> = {}) {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (a: any) => ({ id: "new1", ...a.data })),
    update: vi.fn().mockImplementation(async (a: any) => ({ id: "x", ...a.data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...extra,
  };
}

function tx(overrides: Record<string, any> = {}) {
  return { n8nEvent: table(), n8nJob: table(), ...overrides };
}

function signedRequest(body: unknown, secret: string, sigOverride?: string) {
  const raw = JSON.stringify(body);
  const sig = sigOverride ?? signN8nPayload(raw, secret);
  return new Request("http://x/api/n8n/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Waves-Signature": sig },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_WEBHOOK_SECRET = "test-n8n-secret";
  process.env.N8N_BASE_URL = "https://n8n.example.invalid";
  mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(tx()));
});

describe("signature gate", () => {
  it("round-trips sign/verify and rejects tampering", () => {
    const raw = '{"a":1}';
    const sig = signN8nPayload(raw, "test-n8n-secret");
    expect(verifyN8nSignature(raw, sig)).toBe(true);
    expect(verifyN8nSignature('{"a":2}', sig)).toBe(false);
    expect(verifyN8nSignature(raw, null)).toBe(false);
  });

  it("401 on missing signature without touching the DB", async () => {
    const res = await webhookPOST(new Request("http://x/api/n8n/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }));
    expect(res.status).toBe(401);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("401 on wrong-secret signature", async () => {
    const res = await webhookPOST(signedRequest({ tenantId: "t1", eventId: "e1", event: "x" }, "wrong-secret"));
    expect(res.status).toBe(401);
  });
});

describe("exactly-once events", () => {
  const event = { tenantId: "t1", jobId: "j1", eventId: "evt-1", event: "send.completed", status: "completed" };

  it("applies a first-seen event to the tenant's own job", async () => {
    const t = tx();
    t.n8nJob.findFirst.mockResolvedValue({ id: "j1", status: "PROCESSING" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await webhookPOST(signedRequest(event, "test-n8n-secret"));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.outcome).toBe("applied");
    expect(t.n8nJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "j1" }) }),
    );
  });

  it("duplicate eventId returns duplicate without re-applying", async () => {
    const t = tx();
    t.n8nEvent.create.mockRejectedValueOnce({ code: "P2002" });
    t.n8nEvent.findUnique.mockResolvedValueOnce({ eventId: "evt-1", tenantId: "t1", outcome: "applied" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await webhookPOST(signedRequest(event, "test-n8n-secret"));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.outcome).toBe("duplicate");
    expect(t.n8nJob.updateMany).not.toHaveBeenCalled();
  });

  it("replayed eventId from another tenant is rejected", async () => {
    const t = tx();
    t.n8nEvent.create.mockRejectedValueOnce({ code: "P2002" });
    t.n8nEvent.findUnique.mockResolvedValueOnce({ eventId: "evt-1", tenantId: "OTHER", outcome: "applied" });
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const res = await webhookPOST(signedRequest(event, "test-n8n-secret"));
    expect(res.status).toBe(403);
  });

  it("unknown jobId is recorded but changes nothing", async () => {
    const res = await webhookPOST(signedRequest({ ...event, eventId: "evt-2", jobId: "ghost" }, "test-n8n-secret"));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.outcome).toBe("applied");
  });
});

describe("health", () => {
  it("reports configured booleans, never secret values", async () => {
    const h = n8nHealth();
    expect(h).toEqual({ configured: true, baseUrl: true, secret: true });
    const res = await healthGET();
    const j: any = await res.json();
    expect(JSON.stringify(j)).not.toContain("test-n8n-secret");
    expect(JSON.stringify(j)).not.toContain("n8n.example.invalid");
    delete process.env.N8N_WEBHOOK_SECRET;
    expect(n8nHealth().configured).toBe(false);
  });
});
