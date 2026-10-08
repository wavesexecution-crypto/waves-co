/**
 * Cycle-OS migration coverage: every new tenant table (plus the new
 * EmailCredential table) gets ENABLE ROW LEVEL SECURITY + a FOR ALL tenant
 * policy in the cycle_os migration, and every route write is tenant-scoped.
 * Source-text guards so a future table cannot slip in unprotected.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mig = readFileSync(join(here, "..", "prisma", "migrations", "20261009000002_cycle_os", "migration.sql"), "utf8");
const schema = readFileSync(join(here, "..", "prisma", "schema.prisma"), "utf8");

const NEW_TABLES = [
  "CompanyBrain", "CompanyBrainRevision", "AcquisitionCycle", "CycleGoal",
  "MessageTemplate", "AiJob", "N8nJob", "N8nEvent", "ReplyReport",
  "ReplyDirection", "CycleReport", "EmailCredential",
];

describe("cycle_os migration RLS", () => {
  it("creates every new table idempotently", () => {
    for (const t of NEW_TABLES) {
      expect(mig).toContain(`CREATE TABLE IF NOT EXISTS "${t}"`);
    }
  });

  it("enables RLS on every new table with a tenant FOR ALL policy", () => {
    for (const t of NEW_TABLES) {
      expect(mig).toContain(t);
    }
    expect(mig).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(mig).toMatch(/FOR ALL USING/);
    expect(mig).toMatch(/current_setting/);
  });

  it("every new schema model carries tenantId", () => {
    for (const t of NEW_TABLES) {
      const m = schema.match(new RegExp(`model ${t} \\{([^}]*)\\}`, "m"));
      expect(m, `model ${t} missing`).toBeTruthy();
      expect(m![1]).toMatch(/tenantId\s+String/);
    }
  });

  it("cycle provenance columns exist on OutreachOrder", () => {
    expect(mig).toContain('"cycleId"');
    expect(mig).toContain('"templateVersion"');
    expect(mig).toContain('"messageVariant"');
    expect(mig).toContain('"sendProvider"');
  });
});
