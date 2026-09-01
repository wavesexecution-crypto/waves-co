import {
  AlertTriangle,
  CircleDashed,
  Clock,
  GitBranch,
  LockKeyhole,
} from "lucide-react";
import type { Metadata } from "next";

import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { DependencyVisual } from "@/components/dependency-visual";
import { ProcessFlow } from "@/components/process-flow";
import { auditCycle } from "@/lib/audit-cycle";
import { Products } from "@/components/products";
import { siteConfig } from "@/app/site";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

const problems = [
  {
    title: "Everything depends on you.",
    body: "The company moves at the speed of your attention because too much still lives in your head.",
    icon: LockKeyhole,
  },
  {
    title: "Every decision waits for you.",
    body: "Small calls become approvals. Approvals become queues. The queue becomes the constraint.",
    icon: Clock,
  },
  {
    title: "Growth creates more chaos.",
    body: "More clients, people, and work expose the gaps that informal coordination used to hide.",
    icon: GitBranch,
  },
  {
    title: "You can't step away.",
    body: "A week offline feels risky because exceptions, handoffs, and ownership are still unclear.",
    icon: AlertTriangle,
  },
];

const solution = [
  {
    title: "Understand.",
    body: "We map how work actually moves, including the decisions that never make it into documents.",
  },
  {
    title: "Diagnose.",
    body: "We identify what still depends on you: unclear ownership, weak controls, missing rhythms, and decision debt.",
  },
  {
    title: "Design.",
    body: "We design roles, decision rights, process flows, reporting, review loops, and escalation rules.",
  },
  {
    title: "Install.",
    body: "We install the system with your team until the company can operate without constant intervention.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="border-b border-line bg-paper">
        <Container className="grid min-h-[calc(100vh-4rem)] gap-8 py-24 sm:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <Badge>Systems Architecture</Badge>
            <h1 className="mt-8 max-w-5xl font-heading text-[64px] font-semibold leading-[0.92] tracking-[-0.03em] text-navy sm:text-[80px] lg:text-[88px]">
              Take a month off.
              <br />
              Nothing breaks.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-[1.6] tracking-normal text-body">
              We build the operating system that lets your team run operations, make decisions, and keep standards without waiting for you.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button href="/architecture-audit">
                Book Architecture Review
              </Button>
              <Button href="/case-study" variant="secondary">
                View Case Study
              </Button>
            </div>
            <p className="mt-8 max-w-xl border-l border-line pl-6 text-sm leading-6 text-body">
              Built for founder-led companies with real revenue, real teams, and
              operations that have outgrown memory and improvisation.
            </p>
          </Reveal>
          <Reveal delay={0.12} className="w-full lg:scale-105 xl:scale-110 origin-center">
            <ArchitectureDiagram />
          </Reveal>
        </Container>
      </section>

      <Section className="py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <Badge>Problem</Badge>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            Most companies don't have a people problem.
            <br />
            They have a systems problem.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <Reveal key={problem.title} delay={index * 0.05}>
                <article className="premium-card h-full rounded-sm p-8">
                  <Icon aria-hidden="true" className="text-navy" size={24} strokeWidth={1.6} />
                  <h3 className="mt-8 font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[28px]">
                    {problem.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-body">{problem.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <Badge>Dependency Diagnostics</Badge>
            <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              The Founder Dependency Trap.
            </h2>
            <p className="mt-6 text-lg leading-[1.6] text-body">
              When every decision runs through you, growth is capped by your
              calendar. We move ownership from one person into a system your team
              can trust.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="w-full">
            <DependencyVisual />
          </Reveal>
        </div>
      </Section>

      <Section className="border-y border-line bg-white py-24 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal>
            <Badge>Solution</Badge>
            <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              We build the systems your company is missing.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
              Wavesco replaces founder-dependent coordination with clear roles,
              decision rights, review loops, and handoffs. The result is a
              company that knows how work moves.
            </p>
          </Reveal>
          <div className="grid gap-4">
            {solution.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.05}>
                <article className="premium-card grid gap-6 rounded-sm bg-paper p-8 sm:grid-cols-[80px_1fr]">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <h3 className="font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[28px]">
                      {item.title}
                    </h3>
                    <p className="mt-2 leading-7 text-body">{item.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section id="audit-cycle" className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Audit Cycle — Waves methodology
          </div>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            Diagnose first.
            <br />
            <span className="text-muted">Then design, build, and monitor.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
            Every Waves engagement follows the same 8 stages — from read-only discovery with our diagnostic suite to
            monitored deployment. No assumptions, no mutation until evidence is in.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs tracking-wider text-muted">
            <span className="rounded-sm border border-line bg-white px-3 py-1">5 tools</span>
            <span className="rounded-sm border border-line bg-white px-3 py-1">300 tests</span>
            <span className="rounded-sm border border-line bg-white px-3 py-1">read-only · bounded · masked</span>
            <span className="rounded-sm border border-line bg-white px-3 py-1">v0.1.0 · 2026-09-02</span>
          </div>
        </Reveal>

        <div className="mt-12 hidden md:flex items-center justify-between gap-2 overflow-x-auto font-mono text-xs tracking-wider text-muted">
          {auditCycle.map((stage, i) => (
            <div key={stage.code} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                  {stage.n}
                </div>
                <div className="text-[10px] font-semibold tracking-widest text-accent">{stage.code}</div>
              </div>
              {i < auditCycle.length - 1 && <div className="h-px w-6 bg-line" aria-hidden>→</div>}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-1 font-mono text-[10px] tracking-wider text-muted md:hidden">
          {auditCycle.map((s) => (
            <span key={s.code} className="rounded-sm border border-line bg-white px-2 py-1">
              {s.code}
            </span>
          ))}
        </div>

        <div className="mt-12 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
          {auditCycle.map((stage) => (
            <Reveal key={stage.code}>
              <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent">{stage.code}</span>
                  <span className="font-mono text-xs tracking-[0.14em] text-muted">stage {stage.n}</span>
                </div>
                <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                  {stage.title}
                </h3>
                <p className="mt-3 flex-grow text-sm leading-7 text-body">{stage.detail}</p>
                <div className="mt-6 border-t border-line pt-4 font-mono text-xs tracking-[0.14em] text-muted">
                  <span className="text-accent">→</span> {stage.output}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid gap-px bg-line md:grid-cols-3">
          <Reveal>
            <article className="premium-card h-full rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">tooling</div>
              <h4 className="mt-3 font-heading text-[18px] font-semibold text-navy">Waves OSS Diagnostic Suite</h4>
              <p className="mt-3 text-sm leading-7 text-body">
                5 tools — waves-pii, waves-ghost, waves-latency, waves-legacy, waves-sync. Each independently installable,
                Docker-ready (python:3.11-slim, non-root), HTML/JSON/terminal reports at your chosen path.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.05}>
            <article className="premium-card h-full rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">guarantee</div>
              <h4 className="mt-3 font-heading text-[18px] font-semibold text-navy">Read-only. Bounded. Masked.</h4>
              <p className="mt-3 text-sm leading-7 text-body">
                No DELETE/Terminate, no credential storage, no raw PII, SSRF-protected, safe_path-guarded, header
                redacted. Reports show <span className="font-mono text-xs">j***@example.com</span> never raw data.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="premium-card h-full rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">how it&apos;s used</div>
              <h4 className="mt-3 font-heading text-[18px] font-semibold text-navy">Evidence → architecture review</h4>
              <p className="mt-3 text-sm leading-7 text-body">
                PII privacy review, Ghost FinOps, Latency platform, Legacy modernization, Sync reconciliation — the tools
                diagnose; Waves builds the OS in a separate, approved workflow.
              </p>
            </article>
          </Reveal>
        </div>

        <p className="mt-8 font-mono text-xs tracking-[0.14em] text-muted">
          Source of truth: <span className="text-navy">Waves/OSS → 05 Audit Cycle</span> · Verified 2026-09-02 · 83 (legacy) + 30 (sync) tests · Docker + Quick Start validated
        </p>
      </Section>

      <Products />

      <Section id="process" className="py-24 sm:py-32">
        <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              <CircleDashed size={14} aria-hidden="true" />
              Architecture Review
            </div>
            <h2 className="max-w-3xl font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] sm:text-[40px]">
              Ready to see what still depends on you?
            </h2>
          </div>
          <Button href="/architecture-audit" className="w-fit">
            Book Architecture Review
          </Button>
        </Container>
      </Section>
    </main>
  );
}
