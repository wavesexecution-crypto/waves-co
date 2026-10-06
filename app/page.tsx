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
    title: "Research eats your week.",
    body: "Finding the right prospects, checking they exist, and recording their details is a full-time job that produces no customers.",
    icon: LockKeyhole,
  },
  {
    title: "The list goes stale.",
    body: "A spreadsheet of leads is out of date before you finish writing the first email. Nobody calls them back.",
    icon: Clock,
  },
  {
    title: "Outreach does not scale.",
    body: "The tenth sequence gets worse, not better. Quality drops exactly when volume matters most.",
    icon: GitBranch,
  },
  {
    title: "You cannot let go of it.",
    body: "You cannot take a week off, because the follow-ups only happen when you remember them.",
    icon: AlertTriangle,
  },
];

const solution = [
  {
    title: "Discover",
    body: "Acquisition OS researches your market and finds businesses that match your ideal customer, without you hiring a researcher.",
  },
  {
    title: "Verify",
    body: "Every prospect's email is verified and every contact record is checked before it reaches an approval queue.",
  },
  {
    title: "Qualify",
    body: "Leads are scored against your criteria, so you review a ranked list instead of a spreadsheet of guesses.",
  },
  {
    title: "Outreach",
    body: "Personalised emails are drafted for each lead and queued for your approval. Nothing is ever sent automatically.",
  },
  {
    title: "Follow up",
    body: "Replies are routed to you, follow-ups run on schedule, and bounces and unsubscribes are honoured automatically.",
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
              <Button href="/signup?from=proof">
                Start the 2-Day Proof
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

      {/* What Acquisition OS does */}
      <Section className="py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <Badge>Acquisition OS</Badge>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            The whole outbound process, on repeat.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
            Outbound acquisition is five repetitive jobs. Acquisition OS runs all five continuously, so the only thing
            left for you is the approval decision.
          </p>
        </Reveal>
      </Section>

      {/* Why it is worth the lease */}
      <Section className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <Badge>Why it pays for itself</Badge>
            <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              One closed customer covers the lease.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
              The work this replaces — a researcher, a data provider, an SDR writing and sending sequences, and a
              follow-up tracker — is the cost line you are already paying. One additional customer pays for the lease.
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
          <Badge>How it works</Badge>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            Five steps, every run.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
            Each one is a job you would otherwise staff, schedule and check by hand.
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
            You approve. Acquisition OS sends.
          </p>
          <p className="mt-4 max-w-xl mx-auto text-body">
            Nothing reaches a prospect without your explicit approval. The system does the searching, verifying,
            scoring and drafting — you make the one decision that carries your reputation.
          </p>
        </div>
      </Section>

      {/* Product Proof / Interface Preview */}
      <Section id="audit-cycle" className="border-t border-line bg-paper/40 py-24 sm:py-32">
        <Reveal className="max-w-4xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            What you get
          </div>
          <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            What the system produces for you.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
            Acquisition OS works against your own market and your own brief. The output is specific to the business you
            describe, not a shared list.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
          <Reveal>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">discover</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                A researched prospect list
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Businesses in your geography and category, matched to your ideal customer and scored.</p>
            </article>
          </Reveal>
          <Reveal delay={0.05}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">verify</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                Deliverable contact data
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Email status verified before anything is queued, so bounces and damage to your domain reputation are avoided.</p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">approve</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                Drafts you read and send
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Every message is written for that specific business and waits for your approval. Nothing sends itself.</p>
            </article>
          </Reveal>
          <Reveal delay={0.15}>
            <article className="premium-card flex h-full flex-col rounded-sm bg-white p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">follow up</div>
              <h3 className="mt-4 font-heading text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[22px]">
                Replies and a readable report
              </h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">Replies routed to you, follow-ups on schedule, and a report showing what was sent, opened and answered.</p>
            </article>
          </Reveal>
        </div>

        <p className="mt-8 font-mono text-xs tracking-[0.14em] text-muted">
          Built from your brief and your market · Results depend on the segment you lease it for
        </p>
      </Section>

      {/* Acquisition OS — the single product */}
      <Products />

      {/* Acquisition OS Pricing / Lease */}
      <LeasePricing />

      {/* Why WAVES / CTA */}
      <Section id="process" className="py-24 sm:py-32">
        <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              <CircleDashed size={14} aria-hidden="true" />
              Start here
            </div>
            <h2 className="max-w-3xl font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] sm:text-[40px]">
              See it work on your business first.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.6] text-body">
              Start the 2-Day Proof. Describe your market and offer, and Acquisition OS researches it and produces a
              real prospect list and drafted outreach — before you pay anything.
            </p>
          </div>
          <Button href="/signup?from=proof" className="w-fit">
            Start the 2-Day Proof
          </Button>
        </Container>
      </Section>
    </main>
  );
}