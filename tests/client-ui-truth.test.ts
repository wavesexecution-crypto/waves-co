/**
 * Client UI truth guards for the Acquisition OS shell.
 *
 * - The client-facing AI name is WAVE AI: provider/model implementation
 *   details (Ollama, model names, key names, n8n branding) must never appear
 *   in product UI copy.
 * - The acquisition shell has exactly ONE header (no duplicated nav).
 * - The primary product structure is the six-step cycle, not module cards.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function uiFiles(): string[] {
  const roots = [join(here, "..", "app", "acquisition"), join(here, "..", "components")];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(p)) out.push(p);
    }
  };
  for (const r of roots) walk(r);
  return out;
}

const BANNED = ["Ollama", "ollama", "gpt-oss", "gemma", "OLLAMA_API_KEY", "n8n.wavesco.in", "Anthropic", "OpenAI"];

describe("client UI never exposes provider internals", () => {
  it("no banned provider term in acquisition UI or shared components", () => {
    const hits: string[] = [];
    for (const f of uiFiles()) {
      const src = readFileSync(f, "utf8");
      // Strip code identifiers: only user-visible string literals count.
      const literals = [...src.matchAll(/["'`]([^"'`]*?)["'`]/g)].map((m) => m[1]).join("\n");
      for (const term of BANNED) {
        if (literals.includes(term)) hits.push(`${f.split("waves-co")[1]}: ${term}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("cycle UI names the client AI WAVE AI wherever AI work is shown", () => {
    const email = readFileSync(join(here, "..", "app", "acquisition", "cycle", "email", "page.tsx"), "utf8");
    const jobs = readFileSync(join(here, "..", "app", "acquisition", "cycle", "jobs", "page.tsx"), "utf8");
    expect(email).toMatch(/WAVE AI/);
    expect(jobs).toMatch(/WAVE AI/);
  });
});

describe("single OS navigation", () => {
  it("acquisition layout renders one header: module nav + cycle steps, no marketing nav", () => {
    const layout = readFileSync(join(here, "..", "app", "acquisition", "layout.tsx"), "utf8");
    expect(layout.match(/<header/g)?.length ?? 0).toBe(1);
    expect(layout).not.toMatch(/from ["']@\/components\/navigation["']/);
    // Control-center module navigation is preserved…
    for (const href of ["/acquisition", "/acquisition/leads", "/acquisition/outreach", "/acquisition/replies", "/acquisition/results", "/acquisition/billing"]) {
      expect(layout).toContain(`href="${href}"`);
    }
    // …and the six-step workflow rides in the same header via CycleNav.
    expect(layout).toMatch(/CycleNav/);
  });

  it("step nav covers all six steps exactly once", () => {
    const nav = readFileSync(join(here, "..", "app", "acquisition", "cycle-nav.tsx"), "utf8");
    for (const [n, href] of [
      ["01", "/acquisition/cycle/brain"],
      ["02", "/acquisition/cycle/goal"],
      ["03", "/acquisition/cycle/email"],
      ["04", "/acquisition/cycle/send"],
      ["05", "/acquisition/cycle/responses"],
      ["06", "/acquisition/cycle/report"],
    ]) {
      expect(nav).toContain(`"${n}"`);
      expect(nav).toContain(href);
    }
  });

  it("control-center home leads with the cycle workflow and keeps module surfaces", () => {
    const home = readFileSync(join(here, "..", "app", "acquisition", "page.tsx"), "utf8");
    // Primary operating workflow first…
    expect(home).toMatch(/Current workflow/);
    expect(home).toMatch(/Wave Cycle/);
    expect(home).toMatch(/Company Brain/);
    // …with the original command-center blocks preserved.
    expect(home).toMatch(/Your next step/);
    expect(home).toMatch(/QuickLink/);
    expect(home).toMatch(/StatCard/);
    expect(home).toMatch(/Manage lease/);
  });
});
