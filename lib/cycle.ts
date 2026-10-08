/**
 * Acquisition cycle helpers: numbering, goal validation, open-cycle guards.
 * Cycle history is immutable — code paths refuse writes to CLOSED cycles
 * (there is deliberately no update/delete route for closed data).
 */
import { z } from "zod";

export const CycleGoalSchema = z.object({
  title: z.string().trim().min(4).max(200),
  audience: z.string().trim().max(1000).nullish(),
  segment: z.string().trim().max(500).nullish(),
  geography: z.string().trim().max(500).nullish(),
  companyTraits: z.record(z.string(), z.unknown()).nullish(),
  qualification: z.record(z.string(), z.unknown()).nullish(),
  exclusions: z.record(z.string(), z.unknown()).nullish(),
  outcome: z.string().trim().max(1000).nullish(),
  angle: z.string().trim().max(2000).nullish(),
  constraints: z.record(z.string(), z.unknown()).nullish(),
});

export type CycleGoalInput = z.infer<typeof CycleGoalSchema>;

/** Atomically assign the next per-tenant cycle number (unique-guarded). */
export async function allocateCycleNumber(tx: any, tenantId: string): Promise<{ id: string; cycleNumber: number }> {
  const agg = await tx.acquisitionCycle.aggregate({ where: { tenantId }, _max: { cycleNumber: true } });
  const next = ((agg._max?.cycleNumber as number | null) ?? 0) + 1;
  // Unique constraint is the arbiter under concurrency; retry upward rarely.
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = next + attempt;
    try {
      const row = await tx.acquisitionCycle.create({
        data: { tenantId, cycleNumber: n, status: "ACTIVE" },
      });
      return { id: row.id, cycleNumber: n };
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate cycle number");
}

export function formatCycleNumber(n: number): string {
  return `WAVE CYCLE ${String(n).padStart(2, "0")}`;
}

/** Load an open (non-closed) cycle scoped to the tenant, or null. */
export async function getOpenCycle(tx: any, tenantId: string, cycleId: string): Promise<any | null> {
  const cycle = await tx.acquisitionCycle.findFirst({ where: { id: cycleId, tenantId } });
  if (!cycle || cycle.status === "CLOSED") return null;
  return cycle;
}
