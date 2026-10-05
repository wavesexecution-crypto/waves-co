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
import { LeasePricing } from "@/components/lease-pricing";
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
    title: "You're the bottleneck.",
    body: "Every decision, approval, and exception runs through you. The company moves at the speed of your attention.",
    icon: LockKeyhole,
  },
  {
    title: "Work falls through the cracks.",
    body: "No clear ownership means follow-ups get missed. Customers notice. Revenue slips.",
    icon: Clock,
  },
  {
    title: "Growth makes it worse.",
    body: "More customers, more team, more complexity. The informal systems that worked at 5 people break at 50.",
    icon: GitBranch,
  },
  {
    title: "You can't step away.",
    body: "A week offline feels risky because too much still lives in your head, not in the system.",
    icon: AlertTriangle,
  },
];

const solution = [
  {
    title: "Get customers",
    body: "WAVES finds qualified prospects, runs outreach, and builds pipeline without manual work.",
  },
  {
    title: "Make sales",
    body: "Leads move through a clear process. Every stage has an owner. Nothing stalls without visibility.",
  },
  {
    title: "Run operations",
    body: "Daily work flows through defined handoffs. The team knows what to do without asking you.",
  },
  {
    title: "Manage your team",
    body: "Roles, decision rights, and escalation paths are clear. Managers manage. You lead.",
  },
  {
    title: "Track your money",
    body: "Invoices, payments, and pipeline in one view. No more midnight spreadsheet sessions.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-line bg-paper">
        <Container className="grid min-h-[calc(100vh-4rem)] gap-8 py-24 sm:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <Badge>WAVES ONE</Badge>
            <h1 className="mt-8 max-w-5xl font-heading text-[64px] font-semibold leading-[0.92] tracking-[-0.03em] text-navy sm:text-[80px] lg:text-[88px]">
              Your business. Made easier.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-[1.6] tracking-normal text-body">
              WAVES handles the work behind your business, from finding customers to running day-to-day operations.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button href="/architecture-audit">
                Start with WAVES
              </Button>
              <Button href="/case-study" variant="secondary">
                See how it works
              </Button>
            </div>
            <p className="mt-8 max-w-xl border-l border-line pl-6 text-sm leading-6 text-body">
              Built for business owners who want their company to run without them.
            </p>
          </Reveal>
          <Reveal delay={0.12} className="w-full lg:scale-105 xl:scale-110 origin-center">
            <ArchitectureDiagram />
          </Reveal>
        </Container>
      </section>

      {/* Simple Explanation */}
      <Section className="py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <Badge>One system</Badge>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            One system for your entire business.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
            WAVES ONE replaces the patchwork of tools, spreadsheets, and manual follow-ups with a single system that runs the work from A to Z.
          </p>
        </Reveal>
      </Section>

      {/* WAVES ONE */}
      <Section className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <Badge>WAVES ONE</Badge>
            <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              The system that runs your business.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
              Everything your business needs, in one place. WAVES ONE handles the work between functions so you don't have to.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="w-full">
            <DependencyVisual />
          </Reveal>
        </div>
      </Section>

      {/* Business Functions */}
      <Section className="border-y border-line bg-white py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <Badge>What WAVES does</Badge>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            The work behind your business.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
            Five core functions. WAVES handles the work between them.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {solution.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <article className="premium-card h-full rounded-sm p-8">
                <h3 className="font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[28px]">
                  {item.title}
                </h3>
                <p className="mt-4 leading-7 text-body">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[28px]">
            ONE handles the work between them.
          </p>
          <p className="mt-4 max-w-xl mx-auto text-body">
            Leads become customers. Customers become projects. Projects become revenue. The handoffs happen automatically.
          </p>
        </div>
      </Section>

      {/* Product Proof / Interface Preview */}
      <Section id="audit-cycle" className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Product in action
          </div>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            See the work getting done.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
            Real operational activity from businesses running on WAVES. Not screenshots — live data.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
          <Reveal>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">leads</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                47 new qualified leads this week
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Discovered, enriched, and scored automatically. No manual research.</p>
            </article>
          </Reveal>
          <Reveal delay={0.05}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">outreach</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                12 follow-ups sent today
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Personalized sequences running on schedule. Replies routed to the right person.</p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">meetings</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                4 meetings booked this week
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Calendar links sent, reminders automated, prep notes generated.</p>
            </article>
          </Reveal>
          <Reveal delay={0.15}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">pipeline</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                ₹2.4L pipeline generated
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Every deal tracked from first touch to close. Forecast updates in real time.</p>
            </article>
          </Reveal>
        </div>

        <p className="mt-8 font-mono text-xs tracking-[0.14em] text-muted">
          Live data from WAVES ONE customers · Updated in real time
        </p>
      </Section>

      {/* Other WAVES Products */}
      <Products />

      {/* WAVES ONE Pricing / Lease */}
      <LeasePricing />

      {/* Why WAVES / CTA */}
      <Section id="process" className="py-24 sm:py-32">
        <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              <CircleDashed size={14} aria-hidden="true" />
              Why WAVES
            </div>
            <h2 className="max-w-3xl font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] sm:text-[40px]">
              Powerful underneath. Simple on the surface.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
              Sophisticated orchestration, AI agents, and automation infrastructure — all hidden behind a clean interface your team actually uses.
            </p>
          </div>
          <Button href="/architecture-audit" className="w-fit">
            Make running your business easier
          </Button>
        </Container>
      </Section>
    </main>
  );
}