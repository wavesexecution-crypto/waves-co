import { describe, it, expect } from "vitest";
import {
  buildIdempotencyKey,
  resolveNotificationContent,
  resolveResourceHref,
  resolveResourceType,
} from "../lib/notifications/pure";
import { NOTIFICATION_EVENT_TYPES } from "../lib/notifications/types";

describe("buildIdempotencyKey", () => {
  it("produces the same key for identical inputs", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    expect(a).toBe(b);
  });

  it("produces different keys for different tenants", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t2", "CYCLE_STARTED", "c1", undefined, "in_app");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different event types", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t1", "LEAD_REPORT_READY", "c1", undefined, "in_app");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different channels", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "email");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different cycles", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app");
    const b = buildIdempotencyKey("t1", "CYCLE_STARTED", "c2", undefined, "in_app");
    expect(a).not.toBe(b);
  });

  it("respects deduplication suffixes", () => {
    const a = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app", "x");
    const b = buildIdempotencyKey("t1", "CYCLE_STARTED", "c1", undefined, "in_app", "y");
    expect(a).not.toBe(b);
  });
});

describe("resolveNotificationContent", () => {
  it("resolves CYCLE_STARTED", () => {
    const { title, message } = resolveNotificationContent(
      NOTIFICATION_EVENT_TYPES.CYCLE_STARTED,
      {},
    );
    expect(title).toBe("Acquisition Cycle Started");
    expect(message).toContain("started working on your cycle");
  });

  it("resolves LEAD_GENERATION_COMPLETED with dynamic counts", () => {
    const { message } = resolveNotificationContent(
      NOTIFICATION_EVENT_TYPES.LEAD_GENERATION_COMPLETED,
      { leadCount: 175, qualifiedCount: 24 },
    );
    expect(message).toContain("175 businesses researched");
    expect(message).toContain("24 qualified leads");
  });

  it("resolves LEAD_GENERATION_COMPLETED without counts (fallback)", () => {
    const { message } = resolveNotificationContent(
      NOTIFICATION_EVENT_TYPES.LEAD_GENERATION_COMPLETED,
      {},
    );
    expect(message).toContain("lead research is complete");
  });

  it("resolves each locked milestone to a non-empty title and message", () => {
    const events = Object.values(NOTIFICATION_EVENT_TYPES);
    for (const evt of events) {
      const { title, message } = resolveNotificationContent(evt, {});
      expect(title.length).toBeGreaterThan(0);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("does not expose internal infrastructure terms", () => {
    const events = Object.values(NOTIFICATION_EVENT_TYPES);
    const banned = ["n8n", "Neon", "Ollama", "queue", "worker", "model"];
    for (const evt of events) {
      const { title, message } = resolveNotificationContent(evt, {});
      for (const term of banned) {
        expect(title.toLowerCase()).not.toContain(term.toLowerCase());
        expect(message.toLowerCase()).not.toContain(term.toLowerCase());
      }
    }
  });
});

describe("resolveResourceHref", () => {
  it("links lead report to cycle report path", () => {
    const href = resolveResourceHref(
      NOTIFICATION_EVENT_TYPES.LEAD_REPORT_READY,
      { cycleId: "cycle-1" },
    );
    expect(href).toContain("/acquisition/cycles/cycle-1/report");
  });

  it("links campaign deployed to campaign path", () => {
    const href = resolveResourceHref(
      NOTIFICATION_EVENT_TYPES.CAMPAIGN_DEPLOYED,
      { campaignId: "cam-1" },
    );
    expect(href).toContain("/acquisition/campaigns/cam-1");
  });

  it("returns null for error notifications without a resource", () => {
    const href = resolveResourceHref(
      NOTIFICATION_EVENT_TYPES.STORAGE_CONNECTION_ERROR,
      {},
    );
    expect(href).toBeNull();
  });

  it("links responses to campaign responses path", () => {
    const href = resolveResourceHref(
      NOTIFICATION_EVENT_TYPES.NEW_RESPONSES_DETECTED,
      { campaignId: "cam-1" },
    );
    expect(href).toContain("/acquisition/campaigns/cam-1/responses");
  });
});

describe("resolveResourceType", () => {
  it("maps each milestone to the correct resource type", () => {
    expect(resolveResourceType("LEAD_REPORT_READY")).toBe("lead_report");
    expect(resolveResourceType("CAMPAIGN_DEPLOYED")).toBe("campaign");
    expect(resolveResourceType("CYCLE_REPORT_READY")).toBe("cycle_report");
    expect(resolveResourceType("NEW_RESPONSES_DETECTED")).toBe("response");
    expect(resolveResourceType("FOLLOW_UP_READY")).toBe("follow_up");
    expect(resolveResourceType("STORAGE_CONNECTION_ERROR")).toBeNull();
  });
});

describe("resource links are client-facing only", () => {
  it("never links to internal/admin/debug pages", () => {
    const events = Object.values(NOTIFICATION_EVENT_TYPES);
    const bannedPaths = [
      "/api/",
      "/admin",
      "/debug",
      "/internal",
      "/_next",
      "/n8n",
      "?debug=",
    ];

    for (const evt of events) {
      const href = resolveResourceHref(evt, {
        cycleId: "c1",
        campaignId: "cam1",
      });
      if (!href) continue;
      for (const banned of bannedPaths) {
        expect(href).not.toContain(banned);
      }
      // All client-facing links should point under /acquisition
      expect(href.startsWith("/acquisition")).toBe(true);
    }
  });
});
