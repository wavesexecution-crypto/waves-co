/**
 * AI job state machine: idempotent creation, leased claims, bounded retry
 * with backoff, terminal FAILED visibility, malformed-output handling.
 */
import { describe, it, expect, vi } from "vitest";
import { jobKey, retryDelayMs, claimJob, completeJob, failJob, JOB_LEASE_TTL_MS } from "@/lib/jobs";

function jobRow(over: Record<string, any> = {}) {
  return {
    id: "j1", tenantId: "t1", operation: "EMAIL_GENERATION", model: "m",
    attempt: 0, maxAttempts: 5, status: "PENDING",
    leaseClaimedAt: null, nextRetryAt: null, error: null, ...over,
  };
}

function condMatches(cond: any, r: any): boolean {
  for (const [k, v] of Object.entries(cond)) {
    if (k === "status") {
      if (r.status !== v) return false;
    } else if (k === "leaseClaimedAt" || k === "nextRetryAt") {
      if (v === null) {
        if (r[k] !== null) return false;
      } else if (v && typeof v === "object" && "lt" in (v as any)) {
        if (!(r[k] !== null && new Date(r[k]) < new Date((v as any).lt))) return false;
      } else if (v && typeof v === "object" && "lte" in (v as any)) {
        if (!(r[k] !== null && new Date(r[k]) <= new Date((v as any).lte))) return false;
      }
    } else if (r[k] !== v) return false;
  }
  return true;
}

function txWith(row: any) {
  const store = { row: { ...row } };
  const match = (where: any) => {
    const r = store.row;
    if (where.id && where.id !== r.id) return false;
    if (where.OR) return (where.OR as any[]).some((c) => condMatches(c, r));
    return Object.entries(where).every(([k, v]) => (k === "id" ? true : condMatches({ [k]: v }, r)));
  };
  return {
    store,
    aiJob: {
      findFirst: vi.fn(async () => ({ ...store.row })),
      findUnique: vi.fn(async () => ({ ...store.row })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!match(where)) return { count: 0 };
        Object.assign(store.row, resolveData(data, store.row));
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(store.row, resolveData(data, store.row));
        return { ...store.row };
      }),
    },
  };
}

function resolveData(data: any, row: any) {
  const out: any = { ...data };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as any)) out[k] = (row[k] ?? 0) + (v as any).increment;
  }
  return out;
}

describe("jobKey + retryDelayMs", () => {
  it("is deterministic per coordinates and distinct across scopes", () => {
    expect(jobKey("t", "op", ["a"])).toBe(jobKey("t", "op", ["a"]));
    expect(jobKey("t", "op", ["a"])).not.toBe(jobKey("t", "op", ["b"]));
    expect(jobKey("t1", "op", ["a"])).not.toBe(jobKey("t2", "op", ["a"]));
  });

  it("backs off exponentially with a 1h cap", () => {
    expect(retryDelayMs(0)).toBe(60_000);
    expect(retryDelayMs(1)).toBe(120_000);
    expect(retryDelayMs(10)).toBe(3_600_000);
    expect(retryDelayMs(100)).toBe(3_600_000);
  });
});

describe("claimJob", () => {
  it("claims PENDING exactly once; second claim loses", async () => {
    const t = txWith(jobRow());
    const first = await claimJob(t as any, "aiJob", { tenantId: "t1" });
    expect(first?.status).toBe("PROCESSING");
    // Simulate a live lease now held: second claim must lose.
    const second = await claimJob(t as any, "aiJob", { tenantId: "t1" });
    expect(second).toBeNull();
  });

  it("recovers stale PROCESSING leases after TTL", async () => {
    const t = txWith(jobRow({
      status: "PROCESSING",
      leaseClaimedAt: new Date(Date.now() - JOB_LEASE_TTL_MS - 1000),
    }));
    const claimed = await claimJob(t as any, "aiJob", { tenantId: "t1" });
    expect(claimed?.status).toBe("PROCESSING");
  });

  it("respects RETRY_PENDING nextRetryAt", async () => {
    const t = txWith(jobRow({ status: "RETRY_PENDING", nextRetryAt: new Date(Date.now() + 600_000) }));
    expect(await claimJob(t as any, "aiJob", { tenantId: "t1" })).toBeNull();
  });
});

describe("failJob touches only fields that exist (strict-schema fake)", () => {
  const FIELDS: Record<string, string[]> = {
    aiJob: ["status", "error", "nextRetryAt", "leaseClaimedAt", "attempt", "result"],
    n8nJob: ["status", "lastError", "nextRetryAt", "leaseClaimedAt", "attempts", "result"],
  };
  function strictTx(table: "aiJob" | "n8nJob", row: any) {
    const store = { row: { ...row } };
    return {
      store,
      [table]: {
        findUnique: async () => ({ ...store.row }),
        update: async ({ data }: any) => {
          for (const k of Object.keys(data)) {
            if (!FIELDS[table].includes(k)) {
              throw new Error(`Unknown field \`${k}\` for ${table} (mirrors Prisma validation)`);
            }
          }
          Object.assign(store.row, data);
          return { ...store.row };
        },
      },
    };
  }

  it("aiJob failures record `error`, never `lastError`", async () => {
    const t = strictTx("aiJob", { id: "j1", status: "PROCESSING", attempt: 5 });
    expect(await failJob(t as any, "aiJob", { id: "j1" }, "boom", 5)).toBe("failed");
    expect(t.store.row).toMatchObject({ status: "FAILED", error: "boom" });
    expect("lastError" in t.store.row).toBe(false);
  });

  it("n8nJob failures record `lastError`, never `error`", async () => {
    const t = strictTx("n8nJob", { id: "j1", status: "PROCESSING", attempts: 1 });
    expect(await failJob(t as any, "n8nJob", { id: "j1" }, "boom", 8)).toBe("retry");
    expect(t.store.row).toMatchObject({ status: "RETRY_PENDING", lastError: "boom" });
    expect("error" in t.store.row).toBe(false);
  });
});

describe("completeJob + failJob", () => {
  it("completes only PROCESSING rows", async () => {
    const t = txWith(jobRow({ status: "PROCESSING" }));
    expect(await completeJob(t as any, "aiJob", "j1", { applied: true })).toBe(true);
    expect(t.store.row.status).toBe("COMPLETED");
    expect(await completeJob(t as any, "aiJob", "j1", {})).toBe(false);
  });

  it("retries with backoff until attempts run out, then FAILED stays visible", async () => {
    const t = txWith(jobRow({ status: "PROCESSING", attempt: 1 }));
    expect(await failJob(t as any, "aiJob", { id: "j1" }, "boom", 5)).toBe("retry");
    expect(t.store.row.status).toBe("RETRY_PENDING");
    expect(new Date(t.store.row.nextRetryAt).getTime()).toBeGreaterThan(Date.now());
    t.store.row.status = "PROCESSING";
    t.store.row.attempt = 5;
    expect(await failJob(t as any, "aiJob", { id: "j1" }, "boom", 5)).toBe("failed");
    expect(t.store.row.status).toBe("FAILED");
    expect(t.store.row.error).toBe("boom");
  });
});

describe("ollama transport failure modes", () => {
  it("times out a hanging provider (408) instead of hanging forever", async () => {
    const { ollamaChat } = await import("@/lib/ollama");
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    try {
      await expect(ollamaChat({
        system: "s", user: "u", requestId: "r",
        config: { baseUrl: "https://ollama.com/api", model: "m", apiKey: "k", timeoutMs: 50 },
      })).rejects.toThrow(/timeout|408/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects empty message.content without calling it success", async () => {
    const { ollamaChat } = await import("@/lib/ollama");
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ message: { content: "  " } }) }));
    try {
      await expect(ollamaChat({
        system: "s", user: "u", requestId: "r",
        config: { baseUrl: "https://ollama.com/api", model: "m", apiKey: "k", timeoutMs: 1000 },
      })).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses to call cloud without a key (typed NOT_CONFIGURED)", async () => {
    const { ollamaChat, OllamaNotConfiguredError } = await import("@/lib/ollama");
    await expect(ollamaChat({
      system: "s", user: "u", requestId: "r",
      config: { baseUrl: "https://ollama.com/api", model: "m", apiKey: null, timeoutMs: 1000 },
    })).rejects.toBeInstanceOf(OllamaNotConfiguredError);
  });
});
