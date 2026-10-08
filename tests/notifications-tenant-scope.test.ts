/**
 * Notification tenant-isolation and producer wiring.
 *
 * Two properties matter for production safety:
 *  1. Every notification read/write runs inside a tenant context, so the
 *     database sees app.tenant_id and RLS applies. The engine itself uses a
 *     bare Prisma client, so without this wrapper notification queries either
 *     fail outright under RLS or silently run unscoped.
 *  2. Notifications a customer is told about are actually generated — no
 *     advertised notification may be a dead hook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

const mocks = vi.hoisted(() => ({ auth: vi.fn(), withTenantContext: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/context", () => ({ withTenantContext: mocks.withTenantContext }));
// Stub the engine so this suite tests the tenant-context WIRING, not the DB.
vi.mock("@/lib/notifications", () => ({
  listNotifications: vi.fn(async () => ({ notifications: [], total: 0, unreadCount: 0 })),
  markAllNotificationsRead: vi.fn(async () => 0),
  markNotificationRead: vi.fn(async () => true),
  createNotification: vi.fn(async () => ({ created: true, notificationId: "n1" })),
  getPreferences: vi.fn(async () => []),
  updatePreferences: vi.fn(async () => undefined),
}));

import { NextRequest } from "next/server";
import { GET as listGET } from "@/app/api/notifications/route";
import { POST as readAllPOST } from "@/app/api/notifications/read-all/route";
import { GET as prefsGET } from "@/app/api/notifications/preferences/route";

const nextReq = (url: string, init?: { method?: string }) => new NextRequest(url, init);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1", tenantId: "t1", role: "owner", email: "o@t.co" } });
  mocks.withTenantContext.mockImplementation(async (tenantId: string, fn: any) => fn({ tenantId }));
});

describe("notification routes run inside the tenant context (RLS-safe)", () => {
  it("GET /api/notifications wraps the query in the session tenant", async () => {
    await listGET(nextReq("https://x/api/notifications"));
    expect(mocks.withTenantContext).toHaveBeenCalledTimes(1);
    expect(mocks.withTenantContext.mock.calls[0][0]).toBe("t1");
  });

  it("read-all scopes to the session tenant, never a client value", async () => {
    await readAllPOST(nextReq("https://x/api/notifications/read-all", { method: "POST" }));
    expect(mocks.withTenantContext.mock.calls[0][0]).toBe("t1");
  });

  it("preferences are tenant-scoped", async () => {
    await prefsGET();
    expect(mocks.withTenantContext.mock.calls[0][0]).toBe("t1");
  });

  it("401s and touches no database without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    for (const call of [() => listGET(nextReq("https://x/api/notifications")), () => prefsGET()]) {
      const res = await call();
      expect(res.status).toBe(401);
    }
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });
});

describe("notification producers are wired to real lifecycle events", () => {
  it("lead import notifies that drafts are ready for review", () => {
    const src = read("app/api/acquisition/leads/route.ts");
    expect(src).toMatch(/onNotificationEvent/);
    expect(src).toMatch(/EMAILS_READY_FOR_REVIEW/);
    // Deduplicated per lead so re-import cannot spam the customer.
    expect(src).toMatch(/deduplicationSuffix/);
  });

  it("a failed send raises an action-required notification", () => {
    // The send pipeline lives in lib/outreach-send.ts (shared by the single
    // send route and the queue drain); the route delegates to it.
    const lib = read("lib/outreach-send.ts");
    expect(lib).toMatch(/EMAIL_CONNECTION_ERROR/);
    const route = read("app/api/acquisition/outreach/send/route.ts");
    expect(route).toMatch(/executeOrderSend/);
  });

  it("no advertised notification is a dead hook (producers call the engine)", () => {
    // Hooks exist in lib; at least one real route must import them, otherwise
    // every notification surface in the product is permanently empty.
    const leads = read("app/api/acquisition/leads/route.ts");
    const send = read("app/api/acquisition/outreach/send/route.ts");
    expect(leads).toMatch(/@\/lib\/notifications/);
    expect(send).toMatch(/@\/lib\/notifications/);
  });
});

describe("product claims match implementation", () => {
  it("marketing no longer promises open/reply tracking or automatic follow-ups", () => {
    const home = read("app/page.tsx");
    const footer = read("components/footer.tsx");
    for (const src of [home, footer]) {
      expect(src).not.toMatch(/opened and answered/i);
      expect(src).not.toMatch(/follow-ups run on schedule/i);
      expect(src).not.toMatch(/unsubscribes are honoured/i);
      expect(src).not.toMatch(/Instant notification when prospects respond/i);
    }
  });

  it("the replies screen states that inbound capture is not connected", () => {
    const replies = read("app/acquisition/replies/page.tsx");
    expect(replies).toMatch(/Inbound capture is not connected/i);
  });

  it("marketing renders pricing from the locked source of truth", () => {
    // The public page must not hardcode amounts; it must render the same
    // server-locked table the billing API charges from.
    expect(read("app/page.tsx")).toMatch(/<LeasePricing\s*\/>/);
    const pricing = read("components/lease-pricing.tsx");
    expect(pricing).toMatch(/from "@\/lib\/leases"/);
    expect(pricing).toMatch(/LEASES/);
    // No literal rupee amounts hardcoded in the marketing page.
    expect(read("app/page.tsx")).not.toMatch(/60,000|1,65,000|3,00,000|5,40,000/);
  });

  it("the locked price table itself is unchanged", () => {
    const leases = read("lib/leases.ts");
    for (const amount of ["6000000", "16500000", "30000000", "54000000"]) {
      expect(leases).toMatch(amount);
    }
    expect(leases).toMatch(/TRIAL_DAYS = 2/);
  });
});