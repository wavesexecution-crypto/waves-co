/**
 * Company Brain — canonical tenant-level business understanding.
 *
 * BOTH entry paths (intake via AcquisitionProfile, Obsidian markdown import)
 * produce EXACTLY this shape. Downstream code (goals, email, reports) reads
 * only this canonical model and never cares which path produced it.
 */
import { z } from "zod";

export const CanonicalBrainSchema = z.object({
  company: z.object({
    // Empty name allowed by the STORAGE schema so parsers stay total;
    // API routes reject blank names with 422 before persisting.
    name: z.string().max(200).default(""),
    website: z.string().max(300).nullish(),
    industry: z.string().max(200).nullish(),
    locations: z.array(z.string().max(200)).default([]),
    businessModel: z.string().max(2000).nullish(),
  }),
  offering: z.object({
    whatWeSell: z.string().max(4000).nullish(),
    products: z.array(z.string().max(300)).default([]),
    offer: z.string().max(4000).nullish(),
  }),
  icp: z.object({
    roles: z.array(z.string().max(200)).default([]),
    industries: z.array(z.string().max(200)).default([]),
    companySize: z.string().max(200).nullish(),
    painPoints: z.string().max(4000).nullish(),
  }),
  positioning: z.object({
    angle: z.string().max(4000).nullish(),
    proof: z.string().max(4000).nullish(),
    exclusions: z.string().max(4000).nullish(),
  }),
  voice: z.object({
    tone: z.string().max(200).nullish(),
    rules: z.array(z.string().max(500)).default([]),
  }),
});

export type CanonicalBrain = z.infer<typeof CanonicalBrainSchema>;

export const EMPTY_BRAIN: CanonicalBrain = {
  company: { name: "", website: null, industry: null, locations: [], businessModel: null },
  offering: { whatWeSell: null, products: [], offer: null },
  icp: { roles: [], industries: [], companySize: null, painPoints: null },
  positioning: { angle: null, proof: null, exclusions: null },
  voice: { tone: null, rules: [] },
};

const str = (v: unknown, max = 4000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const strList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, 50);
  if (typeof v === "string") return v.split(/[,;\n]+/).map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, 50);
  return [];
};

/**
 * OPTION A — deterministic intake mapping from the existing
 * AcquisitionProfile shape. Pure and total: never throws on odd input.
 */
export function brainFromIntake(profile: any): CanonicalBrain {
  const p = profile ?? {};
  const icp = p.icp && typeof p.icp === "object" ? p.icp : {};
  const offer = p.offer && typeof p.offer === "object" ? p.offer : {};
  const brand = p.brand && typeof p.brand === "object" ? p.brand : {};
  const rules = p.rules && typeof p.rules === "object" ? p.rules : {};
  return CanonicalBrainSchema.parse({
    company: {
      name: str(p.companyName, 200) ?? "",
      website: str(p.website, 300),
      industry: str(p.industry ?? p.businessType, 200),
      locations: strList(icp.locations ?? icp.geography),
      businessModel: str(p.businessModel),
    },
    offering: {
      whatWeSell: str(p.whatWeSell),
      products: strList(p.productsServices),
      offer: str(offer.summary ?? offer.text ?? p.priorityProductService),
    },
    icp: {
      roles: strList(icp.roles ?? icp.targetRoles),
      industries: strList(icp.industries ?? icp.targetIndustries),
      companySize: str(icp.companySize, 200),
      painPoints: str(icp.painPoints),
    },
    positioning: {
      angle: str(brand.positioning ?? brand.angle),
      proof: str(brand.proof ?? brand.socialProof),
      exclusions: str(rules.exclusions ?? icp.exclusions),
    },
    voice: { tone: str(brand.tone, 200), rules: strList(rules.voice ?? rules.tone) },
  });
}

/**
 * OPTION B — deterministic Obsidian/vault markdown import. Parses pasted or
 * uploaded markdown (headings -> sections, bullets -> lists) into the SAME
 * canonical shape. No AI required; AI structuring is an optional later job.
 * Pure and total: unknown sections are ignored, never throw.
 */
export function brainFromMarkdown(markdown: string): CanonicalBrain {
  const text = String(markdown ?? "").slice(0, 60_000);
  const sections = new Map<string, string[]>();
  let current = "general";
  let docTitle: string | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !docTitle) {
      // First H1 is the document title (vault note name) — a company-name
      // candidate, not a section.
      docTitle = h1[1].trim().slice(0, 200);
      continue;
    }
    const h = line.match(/^#{2,4}\s+(.+)$/);
    if (h) {
      current = h[1].toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    const bullet = line.match(/^[-*•\d.)]+\s+(.+)$/);
    sections.get(current)?.push(bullet ? bullet[1] : line);
    if (!sections.has(current)) sections.set(current, [bullet ? bullet[1] : line]);
  }
  const pick = (...names: string[]): string[] => {
    const out: string[] = [];
    for (const [k, v] of sections) {
      if (names.some((n) => k.includes(n))) out.push(...v);
    }
    return out.slice(0, 50);
  };
  const firstText = (...names: string[]): string | null => {
    const lines = pick(...names);
    return lines.length ? lines.join(" ").slice(0, 4000) : null;
  };
  const firstLine = (...names: string[]): string | null => {
    const lines = pick(...names);
    return lines.length ? String(lines[0]).slice(0, 200) : null;
  };
  return CanonicalBrainSchema.parse({
    company: {
      name: firstLine("company", "business", "about") ?? docTitle ?? "",
      website: firstLine("website", "site", "url"),
      industry: firstLine("industry", "sector", "vertical"),
      locations: pick("location", "geograph", "market", "citi", "countr"),
      businessModel: firstText("business model", "model", "revenue"),
    },
    offering: {
      whatWeSell: firstText("offer", "sell", "product", "service"),
      products: pick("product", "service", "offering"),
      offer: firstText("offer", "pricing", "package"),
    },
    icp: {
      roles: pick("role", "title", "decision", "persona"),
      industries: pick("industr", "vertical", "segment"),
      companySize: firstLine("size", "employee", "stage"),
      painPoints: firstText("pain", "problem", "challenge", "struggle"),
    },
    positioning: {
      angle: firstText("position", "angle", "differentiat", "why us"),
      proof: firstText("proof", "testimonial", "result", "case stud", "traction"),
      exclusions: firstText("exclu", "not a fit", "avoid", "anti-icp", "bad fit"),
    },
    voice: { tone: firstLine("tone", "voice", "style"), rules: pick("rule", "voice", "tone", "never", "always") },
  });
}

/** Merge rule for re-imports: non-empty incoming fields win; history kept via revisions. */
export function mergeBrains(base: CanonicalBrain, incoming: CanonicalBrain): CanonicalBrain {
  const pickStr = (a: string | null | undefined, b: string | null | undefined) => (b && b.trim() ? b : (a ?? null));
  const pickList = (a: string[], b: string[]) => (b.length ? [...new Set(b)] : a);
  return CanonicalBrainSchema.parse({
    company: {
      name: incoming.company.name.trim() || base.company.name,
      website: pickStr(base.company.website, incoming.company.website),
      industry: pickStr(base.company.industry, incoming.company.industry),
      locations: pickList(base.company.locations, incoming.company.locations),
      businessModel: pickStr(base.company.businessModel, incoming.company.businessModel),
    },
    offering: {
      whatWeSell: pickStr(base.offering.whatWeSell, incoming.offering.whatWeSell),
      products: pickList(base.offering.products, incoming.offering.products),
      offer: pickStr(base.offering.offer, incoming.offering.offer),
    },
    icp: {
      roles: pickList(base.icp.roles, incoming.icp.roles),
      industries: pickList(base.icp.industries, incoming.icp.industries),
      companySize: pickStr(base.icp.companySize, incoming.icp.companySize),
      painPoints: pickStr(base.icp.painPoints, incoming.icp.painPoints),
    },
    positioning: {
      angle: pickStr(base.positioning.angle, incoming.positioning.angle),
      proof: pickStr(base.positioning.proof, incoming.positioning.proof),
      exclusions: pickStr(base.positioning.exclusions, incoming.positioning.exclusions),
    },
    voice: {
      tone: pickStr(base.voice.tone, incoming.voice.tone),
      rules: pickList(base.voice.rules, incoming.voice.rules),
    },
  });
}

/** Small deterministic summary for AI inputRefs (size-capped by construction). */
export function brainSummary(brain: CanonicalBrain): string {
  const b = brain;
  return [
    `Company: ${b.company.name}${b.company.industry ? ` (${b.company.industry})` : ""}${b.company.website ? ` ${b.company.website}` : ""}`,
    b.offering.whatWeSell ? `Sells: ${b.offering.whatWeSell}` : "",
    b.offering.offer ? `Offer: ${b.offering.offer}` : "",
    b.icp.roles.length ? `ICP roles: ${b.icp.roles.join(", ")}` : "",
    b.icp.industries.length ? `ICP industries: ${b.icp.industries.join(", ")}` : "",
    b.icp.painPoints ? `Pains: ${b.icp.painPoints}` : "",
    b.positioning.angle ? `Angle: ${b.positioning.angle}` : "",
    b.positioning.exclusions ? `Exclusions: ${b.positioning.exclusions}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}
