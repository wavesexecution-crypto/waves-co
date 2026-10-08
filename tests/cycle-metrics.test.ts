/**
 * Deterministic cycle metrics: every number comes from stored rows.
 * No AI, no randomness — the same rows always produce the same report.
 */
import { describe, it, expect } from "vitest";
import { computeCycleMetrics } from "@/lib/cycle-metrics";

function fakeTx(orders: any[], research: any[] = []) {
  return {
    outreachOrder: {
      findMany: async () => orders,
    },
    leadResearch: {
      findMany: async ({ where }: any) => research.filter((r) => where.leadKey.in.includes(r.leadKey)),
    },
  };
}

const CYCLE = { id: "c1", cycleNumber: 1, startedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-08") };

function order(over: Record<string, any> = {}) {
  return {
    id: "o", leadKey: "k", status: "SENT", deliveryStatus: "ACCEPTED",
    replyStatus: null, templateVersion: null, messageVariant: null, ...over,
  };
}

describe("computeCycleMetrics", () => {
  it("counts honestly with rates derived from stored rows", async () => {
    const tx = fakeTx([
      order({ id: "a", leadKey: "ka", replyStatus: "INTERESTED", templateVersion: 2, messageVariant: "A" }),
      order({ id: "b", leadKey: "kb", replyStatus: "NOT_INTERESTED", templateVersion: 2, messageVariant: "B" }),
      order({ id: "c", leadKey: "kc", templateVersion: 2, messageVariant: "A" }),
      order({ id: "d", status: "FAILED", leadKey: "kd" }),
    ], [
      { leadKey: "ka", category: "Plumbers" },
      { leadKey: "kb", category: "Plumbers" },
      { leadKey: "kc", category: "Bakeries" },
    ]);
    const m = await computeCycleMetrics(tx, "t1", CYCLE);
    expect(m.prospectsContacted).toBe(3);
    expect(m.emailsAccepted).toBe(3);
    expect(m.replies).toBe(2);
    expect(m.positiveReplies).toBe(1);
    expect(m.replyRate).toBeCloseTo(0.667, 3);
    expect(m.targets).toHaveLength(2);
    expect(m.targets.find((t) => t.category === "Plumbers")).toMatchObject({ sent: 2, replies: 2 });
    expect(m.variants.find((v) => v.messageVariant === "A")).toMatchObject({ sent: 2, replies: 1 });
  });

  it("reports delivered as unknown when no provider evidence exists", async () => {
    const m = await computeCycleMetrics(fakeTx([order({})]), "t1", CYCLE);
    expect(m.delivered).toBe(0);
    expect(m.deliveredKnown).toBe(false);
  });

  it("counts delivered only from real evidence", async () => {
    const m = await computeCycleMetrics(
      fakeTx([order({ deliveryStatus: "DELIVERED" }), order({})]), "t1", CYCLE);
    expect(m.delivered).toBe(1);
    expect(m.deliveredKnown).toBe(true);
  });

  it("empty cycle yields honest zeros, never NaN", async () => {
    const m = await computeCycleMetrics(fakeTx([]), "t1", CYCLE);
    expect(m).toMatchObject({ prospectsContacted: 0, replies: 0, replyRate: 0, positiveRate: 0 });
    expect(m.targets).toEqual([]);
    expect(m.variants).toEqual([]);
  });
});
