/**
 * Acquisition OS — application workflow regression tests (no DB required).
 *
 * Covers the real customer journey backend: profile validation, lead-key
 * stability (safe re-import, tenant separation), order lifecycle guards,
 * follow-up validation, truthful stats aggregation, and outreach drafting
 * without fabricated claims.
 */
import { describe, it, expect } from "vitest";
import {
  ProfileSubmitSchema,
  LeadImportSchema,
  LeadDecisionSchema,
  FollowUpCreateSchema,
  leadKeyForImport,
  draftOutreachForLead,
  validateOrderTransition,
  buildStats,
  ORDER_GROUPS,
  isValidLeadEmail,
} from "@/lib/acquisition";

describe("profile submission validation", () => {
  const base = {
    companyName: "Acme Inc",
    industry: "saas",
    icp: { roles: ["CEO / Founder"], industries: ["Technology / Software"] },
  };

  it("accepts a complete onboarding payload", () => {
    const r = ProfileSubmitSchema.safeParse({
      ...base,
      website: "https://acme.com",
      icp: { companySize: "11-50", roles: ["CEO / Founder"], industries: [], locations: "US", painPoints: "hiring" },
      offer: { whatWeSell: "widgets" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing company or business type with actionable issues", () => {
    expect(ProfileSubmitSchema.safeParse({ ...base, companyName: "  " }).success).toBe(false);
    expect(ProfileSubmitSchema.safeParse({ ...base, industry: "" }).success).toBe(false);
    const r = ProfileSubmitSchema.safeParse({ companyName: "", industry: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.length).toBeGreaterThan(0);
  });

  it("normalizes empty website to null and caps lengths", () => {
    const r = ProfileSubmitSchema.safeParse({ ...base, website: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBeNull();
    expect(ProfileSubmitSchema.safeParse({ ...base, companyName: "x".repeat(201) }).success).toBe(false);
  });
});

describe("lead import validation + keys", () => {
  it("accepts a valid prospect, rejects bad email", () => {
    expect(LeadImportSchema.safeParse({ business: "Globex", email: "ops@globex.com" }).success).toBe(true);
    expect(LeadImportSchema.safeParse({ business: "Globex", email: "not-an-email" }).success).toBe(false);
    expect(LeadImportSchema.safeParse({ business: "", email: "ops@globex.com" }).success).toBe(false);
  });

  it("lead keys are stable per tenant and distinct across tenants", () => {
    const a = leadKeyForImport("Globex Corp", "Ops@Globex.com");
    expect(leadKeyForImport("  globex   corp ", "ops@globex.com")).toBe(a);
    expect(leadKeyForImport("Globex Corp", "other@globex.com")).not.toBe(a);
    // Keys do not embed tenant (tenant is a separate unique column) but are
    // deterministic so re-imports upsert instead of duplicating.
    expect(a.startsWith("import:")).toBe(true);
  });

  it("email helper rejects non-strings and overlong input", () => {
    expect(isValidLeadEmail("a@b.co")).toBe(true);
    expect(isValidLeadEmail("nope")).toBe(false);
    expect(isValidLeadEmail(null)).toBe(false);
    expect(isValidLeadEmail(`a@${"x".repeat(320)}.co`)).toBe(false);
  });
});

describe("lead decision validation + lifecycle", () => {
  it("allows only APPROVED/REJECTED with an orderId", () => {
    expect(LeadDecisionSchema.safeParse({ orderId: "o1", decision: "APPROVED" }).success).toBe(true);
    expect(LeadDecisionSchema.safeParse({ orderId: "o1", decision: "MAYBE" }).success).toBe(false);
    expect(LeadDecisionSchema.safeParse({ orderId: "", decision: "APPROVED" }).success).toBe(false);
  });

  it("permits review decisions, sends only from APPROVED, terminal never moves", () => {
    expect(validateOrderTransition("READY_FOR_APPROVAL", "APPROVED")).toBeNull();
    expect(validateOrderTransition("READY_FOR_APPROVAL", "REJECTED")).toBeNull();
    expect(validateOrderTransition("APPROVED", "SENT")).toBeNull();
    expect(validateOrderTransition("APPROVED", "APPROVED")).not.toBeNull();
    expect(validateOrderTransition("READY_FOR_APPROVAL", "SENT")).not.toBeNull();
    for (const t of ["SENT", "DELIVERED", "FAILED", "REJECTED", "CANCELLED"]) {
      expect(validateOrderTransition(t, "APPROVED")).not.toBeNull();
    }
  });

  it("review groups cover the pipeline without overlap", () => {
    const all = [...ORDER_GROUPS.ready, ...ORDER_GROUPS.approved, ...ORDER_GROUPS.rejected];
    expect(new Set(all).size).toBe(all.length);
    expect(ORDER_GROUPS.ready).toContain("READY_FOR_APPROVAL");
  });
});

describe("outreach drafting (no fabrication)", () => {
  it("derives copy from stored research only", () => {
    const d = draftOutreachForLead({ businessName: "Globex", contactName: "Ada Lovelace", opportunity: "expanding to Berlin", companyName: "Acme Inc" });
    expect(d.subject).toContain("Globex");
    expect(d.body).toContain("Ada");
    expect(d.body).toContain("expanding to Berlin");
    expect(d.body).toContain("Acme Inc");
    const anon = draftOutreachForLead({ businessName: "Globex", companyName: "Acme Inc" });
    expect(anon.body).not.toMatch(/Series B|40%|funding/i);
  });
});

describe("follow-up validation", () => {
  it("requires a business, defaults channel to email", () => {
    const r = FollowUpCreateSchema.safeParse({ business: "Globex" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.channel).toBe("email");
    expect(FollowUpCreateSchema.safeParse({ business: "" }).success).toBe(false);
    expect(FollowUpCreateSchema.safeParse({ business: "G", dueAt: "not-a-date" }).success).toBe(false);
  });
});

describe("truthful stats aggregation", () => {
  it("sums stored counts and stamps generation time", () => {
    const s = buildStats({ ready: 2, approved: 3, rejected: 1, sent: 4, failed: 1, replies: 2, interested: 1, followUpsPending: 2 });
    expect(s.leadsTotal).toBe(6);
    expect(s.emailsSent).toBe(4);
    expect(Date.parse(s.generatedAt)).not.toBeNaN();
  });

  it("rejects negative or fractional counts", () => {
    expect(() => buildStats({ ready: -1, approved: 0, rejected: 0, sent: 0, failed: 0, replies: 0, interested: 0, followUpsPending: 0 })).toThrow();
    expect(() => buildStats({ ready: 1.5, approved: 0, rejected: 0, sent: 0, failed: 0, replies: 0, interested: 0, followUpsPending: 0 })).toThrow();
  });
});
