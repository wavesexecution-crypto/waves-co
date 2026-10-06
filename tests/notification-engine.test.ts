import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

// Use vi.hoisted so the mock factory can reference these before hoisting.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));

// Mock the DB module so we can test engine idempotency deterministically.
vi.mock("../lib/db", () => ({
  prisma: {
    notification: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      findMany: mocks.findMany,
      count: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    notificationPreference: {
      findMany: mocks.findMany,
      createMany: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import {
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  buildNotificationWhere,
} from "../lib/notifications/engine";
import { buildIdempotencyKey } from "../lib/notifications/pure";
import { NOTIFICATION_EVENT_TYPES } from "../lib/notifications/types";

beforeEach(() => {
  mocks.findUnique.mockReset();
  mocks.create.mockReset();
  mocks.findMany.mockReset();
});

describe("createNotification idempotency", () => {
  it("creates a notification the first time", async () => {
    // First call: no existing notification
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.create.mockResolvedValueOnce({ id: "n1" });

    const result = await createNotification({
      tenantId: "t1",
      eventType: "CYCLE_STARTED",
      cycleId: "c1",
    });

    expect(result).toEqual({ created: true, notificationId: "n1" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("does not create a duplicate on the second call", async () => {
    // First call: no existing, create
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.create.mockResolvedValueOnce({ id: "n1" });
    await createNotification({
      tenantId: "t1",
      eventType: "CYCLE_STARTED",
      cycleId: "c1",
    });

    // Second call: existing notification found (same tenant)
    mocks.findUnique.mockResolvedValueOnce({ id: "n1", tenantId: "t1" });

    const result = await createNotification({
      tenantId: "t1",
      eventType: "CYCLE_STARTED",
      cycleId: "c1",
    });

    expect(result).toEqual({ created: false, notificationId: "n1" });
    expect(mocks.create).toHaveBeenCalledTimes(1); // still only 1 create total
  });

  it("handles unique constraint race by returning existing", async () => {
    // First call: no existing, then create throws unique constraint
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.create.mockRejectedValueOnce({ code: "P2002" });
    // Then the catch handler finds the existing
    mocks.findUnique.mockResolvedValueOnce({ id: "n1", tenantId: "t1" });

    const result = await createNotification({
      tenantId: "t1",
      eventType: "CYCLE_STARTED",
      cycleId: "c1",
    });

    expect(result).toEqual({ created: false, notificationId: "n1" });
  });

  it("refuses to hand another tenant's notification out on dedup hit", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "nX", tenantId: "other-tenant" });

    await expect(
      createNotification({ tenantId: "t1", eventType: "CYCLE_STARTED", cycleId: "c1" }),
    ).rejects.toThrow("Notification idempotency conflict");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses a deterministic idempotency key (same key across calls)", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "x" });

    await createNotification({ tenantId: "t1", eventType: "LEAD_REPORT_READY", cycleId: "c1" });
    await createNotification({ tenantId: "t1", eventType: "LEAD_REPORT_READY", cycleId: "c1" });

    // The findUnique should have been called with the same idempotencyKey both times
    const keys = mocks.findUnique.mock.calls.map((c: any[]) => c[0].where.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});


describe("notification tenant isolation (OS1 hardening)", () => {
  const eventType = Object.values(NOTIFICATION_EVENT_TYPES)[0];

  it("listing is always tenant-scoped", () => {
    expect(buildNotificationWhere({ tenantId: "t1" }).tenantId).toBe("t1");
  });

  it("user filter includes tenant-wide (null userId) rows, still tenant-scoped", () => {
    const w = buildNotificationWhere({ tenantId: "t1", userId: "u1" }) as any;
    expect(w.tenantId).toBe("t1");
    expect(w.OR).toEqual([{ userId: "u1" }, { userId: null }]);
  });

  it("idempotency keys bind tenant + event + resource + channel", () => {
    const a = buildIdempotencyKey("t1", eventType, "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t2", eventType, "c1", undefined, "in_app");
    expect(a).not.toBe(b);
    expect(a).toContain("t1");
    expect(buildIdempotencyKey("t1", eventType, "c1", undefined, "in_app")).toBe(a);
  });

  it("engine verifies tenant on dedup hits (both paths)", () => {
    const src = read("lib/notifications/engine.ts");
    expect(src).toMatch(/existing\.tenantId !== tenantId/);
    expect(src).toMatch(/Notification idempotency conflict/);
  });

  it("read/update paths stay tenant-scoped", () => {
    const src = read("lib/notifications/engine.ts");
    expect(src).toMatch(/id: notificationId,\s*\n?\s*tenantId/);
    expect(src).toMatch(/where:\s*{\s*\n?\s*tenantId,\s*\n?\s*read: false/);
  });

  it("POST /api/notifications enforces the owner/admin role gate", () => {
    const src = read("app/api/notifications/route.ts");
    expect(src).toMatch(/canCreateNotification/);
    expect(src).toMatch(/status:\s*403/);
  });
});
