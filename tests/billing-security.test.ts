/**
 * Acquisition OS — backend security regression tests (no DB required).
 *
 * Covers: entitlement access matrix (fail-closed), order tenant ownership
 * (IDOR guard), management-role gating, reset-token hygiene, and
 * source-level guards (server pricing, tenant-mismatch rejection).
 * Notification-engine isolation tests live in tests/notification-engine.test.ts
 * alongside that (uncommitted) feature.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasCommercialAccess, isOrderOwnedByTenant } from "@/lib/billing";
import { canCreateNotification, canManageTenant } from "@/lib/authz";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

describe("entitlement access matrix (locked rules, fail-closed)", () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it("grants access only to unexpired TRIAL (2-day proof) and unexpired ACTIVE", () => {
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: future })).toBe(true);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: future })).toBe(true);
  });

  it("blocks TRIAL at/past expiry and TRIAL without expiry", () => {
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: past })).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL", trialExpiresAt: null })).toBe(false);
    expect(hasCommercialAccess({ status: "TRIAL" })).toBe(false);
  });

  it("blocks ACTIVE at/past expiry and ACTIVE without expiry (fail-closed)", () => {
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: past })).toBe(false);
    expect(hasCommercialAccess({ status: "ACTIVE", expiresAt: null })).toBe(false);
    expect(hasCommercialAccess({ status: "ACTIVE" })).toBe(false);
  });

  it("blocks NONE and all terminal states even with future timestamps", () => {
    expect(hasCommercialAccess(null)).toBe(false);
    expect(hasCommercialAccess(undefined)).toBe(false);
    for (const status of ["NONE", "TRIAL_EXPIRED", "EXPIRED", "CANCELLED", "REFUNDED"]) {
      expect(hasCommercialAccess({ status, trialExpiresAt: future, expiresAt: future })).toBe(false);
    }
  });
});

describe("order tenant ownership (IDOR guard)", () => {
  it("matches only the owning tenant", () => {
    expect(isOrderOwnedByTenant({ tenantId: "t1" }, "t1")).toBe(true);
    expect(isOrderOwnedByTenant({ tenantId: "t1" }, "t2")).toBe(false);
    expect(isOrderOwnedByTenant(null, "t1")).toBe(false);
    expect(isOrderOwnedByTenant({ tenantId: "t1" }, "")).toBe(false);
    expect(isOrderOwnedByTenant({}, "t1")).toBe(false);
  });

  it("orders route rejects cross-tenant idempotency hits without leaking", () => {
    const src = read("app/api/billing/orders/route.ts");
    expect(src).toMatch(/isOrderOwnedByTenant/);
    expect(src).toMatch(/status:\s*409/);
  });

  it("verify route rejects tenant-mismatched orders", () => {
    const src = read("app/api/billing/verify/route.ts");
    expect(src).toMatch(/Order tenant mismatch/);
    expect(src).toMatch(/status:\s*403/);
  });

  it("server derives price from locked table, never client input", () => {
    const src = read("app/api/billing/orders/route.ts");
    expect(src).toMatch(/amountPaise: pricing\.paise/);
    expect(src).not.toMatch(/body\.amount|amountPaise.*body/);
  });
});

describe("notification authorization", () => {
  it("only owners/admins may forge system notifications", () => {
    expect(canCreateNotification("owner")).toBe(true);
    expect(canCreateNotification("admin")).toBe(true);
    expect(canCreateNotification("OWNER")).toBe(true);
    expect(canCreateNotification("member")).toBe(false);
    expect(canCreateNotification("viewer")).toBe(false);
    expect(canCreateNotification(undefined)).toBe(false);
    expect(canCreateNotification(null)).toBe(false);
    expect(canManageTenant("admin")).toBe(true);
    expect(canManageTenant("member")).toBe(false);
  });
});

describe("reset-token hygiene", () => {
  it("never logs the tokenized reset URL", () => {
    const src = read("lib/reset.ts");
    expect(src).not.toMatch(/reset link for \$\{email\}: \$\{resetUrl\}/);
    expect(src).toMatch(/reset link generated for/);
  });
});
