/**
 * Company Brain canonical model: intake and Obsidian paths converge.
 *
 * Both entry paths MUST produce the same CanonicalBrainSchema shape so
 * downstream code never branches on provenance.
 */
import { describe, it, expect } from "vitest";
import { brainFromIntake, brainFromMarkdown, mergeBrains, brainSummary, CanonicalBrainSchema } from "@/lib/brain";

const INTAKE_PROFILE = {
  companyName: "Acme Widgets",
  website: "https://acme.example",
  industry: "Manufacturing",
  businessModel: "B2B SaaS",
  acquisitionObjective: "Book 20 demos",
  icp: {
    roles: ["VP Sales", "RevOps"],
    industries: ["Manufacturing"],
    companySize: "50-500",
    painPoints: "Manual prospecting eats the week",
    locations: ["Texas"],
  },
  offer: { summary: "Done-for-you outreach" },
  brand: { positioning: "Operators, not gurus", tone: "Direct" },
  rules: { exclusions: "No MLMs" },
};

describe("brainFromIntake", () => {
  it("maps the existing intake profile into the canonical shape", () => {
    const brain = brainFromIntake(INTAKE_PROFILE);
    expect(brain.company.name).toBe("Acme Widgets");
    expect(brain.company.website).toBe("https://acme.example");
    expect(brain.icp.roles).toEqual(["VP Sales", "RevOps"]);
    expect(brain.icp.painPoints).toMatch(/Manual prospecting/);
    expect(brain.offering.offer).toMatch(/Done-for-you/);
    expect(brain.positioning.exclusions).toBe("No MLMs");
  });

  it("never throws on hostile/empty input and stays schema-valid", () => {
    for (const bad of [null, undefined, {}, { icp: "nope" }, { companyName: 42 }]) {
      const brain = brainFromIntake(bad);
      expect(() => CanonicalBrainSchema.parse(brain)).not.toThrow();
    }
  });
});

describe("brainFromMarkdown (Obsidian path)", () => {
  it("parses vault markdown into the SAME canonical shape", () => {
    const md = [
      "# Acme Widgets",
      "## Website",
      "- https://acme.example",
      "## Industry",
      "- Manufacturing",
      "## Ideal customer",
      "- Roles: VP Sales",
      "- Pain: Manual prospecting eats the week",
      "## Offer",
      "- Done-for-you outreach",
      "## Positioning",
      "- Operators, not gurus",
    ].join("\n");
    const brain = brainFromMarkdown(md);
    expect(() => CanonicalBrainSchema.parse(brain)).not.toThrow();
    expect(brain.company.name).toBe("Acme Widgets");
    // Same top-level keys as the intake path — downstream never branches.
    expect(Object.keys(brain).sort()).toEqual(Object.keys(brainFromIntake(INTAKE_PROFILE)).sort());
  });

  it("requires a company name (empty vault is rejected upstream, never stored blank silently)", () => {
    const brain = brainFromMarkdown("## Random notes\n- nothing about a company here");
    expect(brain.company.name).toBe("");
  });
});

describe("mergeBrains", () => {
  it("non-empty incoming fields win; base fills the gaps", () => {
    const base = brainFromIntake(INTAKE_PROFILE);
    const incoming = brainFromMarkdown("# Acme Widgets\n## Offer\n- Concierge onboarding included");
    const merged = mergeBrains(base, incoming);
    expect(merged.offering.offer).toMatch(/Concierge onboarding/);
    expect(merged.company.industry).toBe("Manufacturing");
    expect(merged.icp.roles).toEqual(["VP Sales", "RevOps"]);
  });
});

describe("brainSummary", () => {
  it("is deterministic, bounded, and contains the essentials", () => {
    const s1 = brainSummary(brainFromIntake(INTAKE_PROFILE));
    const s2 = brainSummary(brainFromIntake(INTAKE_PROFILE));
    expect(s1).toBe(s2);
    expect(s1.length).toBeLessThanOrEqual(4000);
    expect(s1).toMatch(/Acme Widgets/);
  });
});
