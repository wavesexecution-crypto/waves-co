/**
 * Settle-phase robustness: if validation/apply/usage/settle throws AFTER a
 * successful model call, the job must land retryable with a recorded error —
 * never silently leased (which would hide it until the lease goes stale).
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenantContext: vi.fn(),
}));

vi.mock("@/lib/context", () => ({ withTenantContext: mocks.withTenantContext }));

import { processDueAiJobs } from "@/lib/ai-jobs";

function txWith(failOnCreate: boolean) {
  const row: Record<string, any> = {
    id: "j1", tenantId: "t1", operation: "EMAIL_GENERATION", model: "m",
    attempt: 0, maxAttempts: 5, status: "PENDING", leaseClaimedAt: null,
    nextRetryAt: null, error: null, inputRef: { cycleId: "c1" },
  };
  return {
    row,
    aiJob: {
      findFirst: vi.fn(async () => ({ ...row })),
      findUnique: vi.fn(async () => ({ ...row })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where?.status && row.status !== where.status) return { count: 0 };
        if (data?.status) row.status = data.status;
        else {
          row.status = "PROCESSING";
          row.attempt += 1;
          row.leaseClaimedAt = new Date();
        }
        if (data && typeof data === "object") {
          for (const [k, v] of Object.entries(data)) {
            if (k !== "status" && !(v && typeof v === "object" && "increment" in (v as any))) row[k] = v;
          }
        }
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(row, data);
        return { ...row };
      }),
    },
    clientAiConfig: { findUnique: vi.fn(async () => null) },
    messageTemplate: {
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _max: { version: null } })),
      create: vi.fn(async () => {
        if (failOnCreate) throw new Error("simulated DB outage during apply");
        return { id: "m1" };
      }),
    },
    aiUsageLog: { create: vi.fn(async () => ({})) },
  };
}

const VALID_EMAIL = {
  subject: "Ideas for Acme",
  body: "Hello there, this is a sufficiently long drafted body for validation to accept without complaint.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OLLAMA_API_KEY;
});

describe("settle failures stay visible", () => {
  it("DB error during apply -> RETRY_PENDING with recorded error", async () => {
    process.env.OLLAMA_API_KEY = "test-key";
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: JSON.stringify(VALID_EMAIL) }, model: "m" }),
    }));
    const t = txWith(true);
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    const out = await processDueAiJobs("t1", 1);
    expect(out).toHaveLength(1);
    expect(t.row.status).toBe("RETRY_PENDING");
    expect(String(t.row.error)).toMatch(/settle failed/);
    expect(t.row.nextRetryAt).toBeTruthy();
  });

  it("happy path still completes and applies", async () => {
    process.env.OLLAMA_API_KEY = "test-key";
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: JSON.stringify(VALID_EMAIL) }, model: "m" }),
    }));
    const t = txWith(false);
    mocks.withTenantContext.mockImplementation(async (_tid: string, fn: any) => fn(t));
    await processDueAiJobs("t1", 1);
    expect(t.row.status).toBe("COMPLETED");
  });
});
