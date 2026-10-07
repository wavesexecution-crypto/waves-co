import { describe, it, expect } from "vitest";
import { renderNotificationEmail } from "../lib/notifications/email-template";

describe("renderNotificationEmail", () => {
  it("renders a branded email with title and message", () => {
    const html = renderNotificationEmail({
      title: "Lead Report Ready",
      message: "Your Lead Intelligence Report is ready to review.",
      eventType: "LEAD_REPORT_READY",
      actionHref: "/acquisition/results",
      actionLabel: "View Report",
    });

    expect(html).toContain("WAVES");
    expect(html).toContain("ACQUISITION OS");
    expect(html).toContain("Lead Report Ready");
    expect(html).toContain("Your Lead Intelligence Report is ready to review.");
    expect(html).toContain("View Report");
    expect(html).toContain("/acquisition/results");
  });

  it("renders metadata context lines when present", () => {
    const html = renderNotificationEmail({
      title: "Lead Generation Complete",
      message: "Done",
      eventType: "LEAD_GENERATION_COMPLETED",
      metadata: { leadCount: 175, qualifiedCount: 24 },
    });

    expect(html).toContain("175 businesses researched");
    expect(html).toContain("24 qualified leads");
  });

  it("escapes unsafe HTML in user-supplied message", () => {
    const html = renderNotificationEmail({
      title: "Alert",
      message: "<script>alert('x')</script>",
      eventType: "CYCLE_STARTED",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
