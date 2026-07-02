import type { Metadata } from "next";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { Statistic } from "@/components/statistic";
import { siteConfig } from "@/app/site";

export const metadata: Metadata = {
  title: "Case Study",
  description:
    "How Wavesco helped a founder-led services company move daily approvals into a clearer operating system.",
  alternates: {
    canonical: "/case-study",
  },
  openGraph: {
    title: "Wavesco Case Study",
    description:
      "From daily founder approvals to a company with operating rhythm.",
    url: `${siteConfig.url}/case-study`,
  },
};

const companyMetadata = [
  ["TEAM SIZE", "38 FULL-TIME EMPLOYEES"],
  ["ANNUAL REVENUE", "$4.8M USD"],
  ["INDUSTRY", "COMMERCIAL SERVICES"],
  ["FOUNDER DEPENDENCY", "82 / 100"],
];

const weeks = [
  ["Week 1: Diagnosis & Node Mapping", "Mapped all decision bottlenecks, client exceptions, field schedules, and communication loops."],
  ["Week 2: Autonomy & Escalation Architecture", "Established role boundaries, decision matrices, quality thresholds, and escalation pathways."],
  ["Week 3: Governance & Operating Cadence", "Deployed scorecards, structural manager loops, meeting cadences, and system tracking."],
  ["Week 4: Transfer of Control", "Delegated core operating logic to team leads, reducing founder intervention to true exceptions."],
];

export default function CaseStudyPage() {
  return (
    <main className="bg-paper/40">
      {/* Hero / Report Cover Header */}
      <section className="border-b border-line bg-paper">
        <Container className="py-24 sm:py-32">
          <Reveal>
            {/* Classification details */}
            <div className="flex flex-wrap gap-4 items-center justify-between border-b border-line/60 pb-6 mb-8 font-mono text-[10px] uppercase tracking-widest text-muted">
              <div>CLIENT OPERATIONS CASE STUDY</div>
              <div>FILE REF: WAVES-CS-084</div>
            </div>
            
            <Badge>System Report</Badge>
            <h1 className="mt-8 max-w-5xl font-heading text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy sm:text-[56px]">
              From daily founder approvals to a company with operating rhythm.
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-[1.6] text-body">
              A founder-led commercial services company had a simple problem:
              routine work still waited for the owner. We rebuilt how decisions,
              handoffs, and reviews moved through the team.
            </p>
          </Reveal>

          {/* Meta Data Box */}
          <Reveal className="premium-card mt-16 rounded-sm p-8">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-wider text-navy font-semibold">
              Before the engagement:
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {companyMetadata.map(([label, value]) => (
                <div key={label} className="border-l border-line/60 pl-6">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
                    {label}
                  </p>
                  <p className="mt-2 font-heading text-lg font-bold leading-tight text-navy">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* 1.0 Challenge / Diagnosis */}
      <Section className="border-b border-line bg-white py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
              1.0 // Diagnosis
            </span>
            <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              Growth increased demand, but control remained centralized in one node.
            </h2>
          </Reveal>
          <Reveal className="grid gap-6 text-lg leading-[1.6] text-body">
            <p>
              The founder handled routine approvals, schedule changes, billing
              exceptions, quality checks, and client issues. None of those
              choices were hard on their own. Together, they created a queue.
            </p>
            <p>
              Managers had responsibility, but not clear authority. Procedures
              were still unwritten, so the team kept checking with the founder.
              Growth multiplied the requests sent to one desk.
            </p>
            <p>
              The business did not need more software. It needed clear operating
              rules, stronger handoffs, and decision rights the team could use.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* 2.0 Architectural Redesign */}
      <Section className="border-b border-line bg-paper/30 py-24 sm:py-32">
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <Reveal className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
              2.0 // Systems Architecture
            </span>
            <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              Moving decisions out of the founder's head and into the company.
            </h2>
          </Reveal>
          <Reveal className="font-mono text-[10px] text-muted text-right hidden md:block">
            OPERATING MODEL // SYS.DWG.084
          </Reveal>
        </div>

        <Reveal className="w-full lg:scale-105 xl:scale-110 origin-center my-6">
          <div className="rounded-sm border border-line/60 bg-white p-2">
            <ArchitectureDiagram />
            <div className="p-3 border-t border-line/45 font-mono text-[9px] text-muted text-center uppercase tracking-widest">
              FIGURE 2.1: DECOUPLED OPERATING PATTERN
            </div>
          </div>
        </Reveal>
      </Section>

      {/* 3.0 Implementation */}
      <Section className="border-b border-line bg-white py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
              3.0 // Implementation
            </span>
            <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              A 4-week deployment window inside the live operation.
            </h2>
            <p className="mt-6 text-lg leading-[1.6] text-body">
              Systems are proven in the real business, not in a slide deck. We
              installed each change with the team while work kept moving.
            </p>
          </Reveal>
          <div className="grid gap-4">
            {weeks.map(([week, body], index) => (
              <Reveal key={week} delay={index * 0.05}>
                <article className="premium-card rounded-sm bg-paper p-8">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-navy font-semibold">
                    {week}
                  </p>
                  <p className="mt-3 text-base leading-7 text-body">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* 4.0 Results */}
      <Section className="border-b border-line bg-paper/20 py-24 sm:py-32">
        <Reveal className="max-w-3xl mb-12">
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
            4.0 // Results
          </span>
          <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            What changed once work had a system.
          </h2>
        </Reveal>
        <Reveal className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Statistic value="18 hrs" label="Founder working hours recovered per week." />
          <Statistic value="41%" label="Reduction in preventable operational errors." />
          <Statistic value="3.2x" label="Increase in standard decision turnaround speed." />
          <Statistic value="82 -> 29" label="Founder dependency index reduction." />
        </Reveal>
      </Section>

      {/* CTA Section */}
      <section className="bg-navy py-24 text-white sm:py-32">
        <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent block mb-4">
              Architecture Review
            </span>
            <h2 className="max-w-3xl font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] sm:text-[40px]">
              Find what still depends on you.
            </h2>
          </div>
          <Button href="/architecture-audit" className="w-fit">
            Book Architecture Review
          </Button>
        </Container>
      </section>
    </main>
  );
}
