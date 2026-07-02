import type { Metadata } from "next";
import { Badge } from "@/components/badge";
import { Container, Section } from "@/components/container";
import { ProcessLine } from "@/components/process-line";
import { Reveal } from "@/components/reveal";
import { siteConfig } from "@/app/site";
import { AuditForm } from "./audit-form";

export const metadata: Metadata = {
  title: "Architecture Audit",
  description:
    "Book a focused architecture review to find where work slows down and what still depends on the founder.",
  alternates: {
    canonical: "/architecture-audit",
  },
  openGraph: {
    title: "Book a Wavesco Architecture Review",
    description:
      "Find where work slows down, where decisions wait, and what still depends on you.",
    url: `${siteConfig.url}/architecture-audit`,
  },
};

export default function ArchitectureAuditPage() {
  return (
    <main className="bg-paper/40">
      {/* Hero / Header cover */}
      <section className="border-b border-line bg-paper">
        <Container className="py-24 sm:py-32">
          <Reveal>
            {/* Classification markings */}
            <div className="flex flex-wrap gap-4 items-center justify-between border-b border-line/60 pb-6 mb-8 font-mono text-[10px] uppercase tracking-widest text-muted">
              <div>Secure Architecture Review Intake</div>
              <div>FILE REF: WAVES-INTAKE-2026</div>
            </div>
            
            <Badge>Engagement Intake</Badge>
            <div className="grid gap-8 mt-8 lg:grid-cols-[1fr_1fr] lg:items-end">
              <div>
                <h1 className="max-w-3xl font-heading text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy sm:text-[56px]">
                  Architecture Audit
                </h1>
              </div>
              <div>
                <p className="max-w-2xl text-lg leading-[1.6] text-body">
                  A focused review of how work moves, where decisions wait, and
                  what still depends on you.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Audit Process Section */}
      <Section className="border-b border-line bg-white py-24 sm:py-32">
        <Reveal className="max-w-3xl mb-12">
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
            Phased Evaluation
          </span>
          <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
            We map where control is lost, why your presence is still required, and what needs to change.
          </h2>
        </Reveal>
        <Reveal className="mt-16">
          <ProcessLine
            compact
            steps={[
              "Diagnostic Call",
              "Node Discovery",
              "Deep System Audit",
              "Architecture Report",
              "Systems Proposal",
            ]}
          />
        </Reveal>
      </Section>

      {/* Diagnostic Form Section */}
      <Section className="bg-white py-24 sm:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <Reveal className="sticky top-24">
            <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-4">
              Intake
            </span>
            <h2 className="font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
              Show us where the business still waits for you.
            </h2>
            <p className="mt-6 text-lg leading-[1.6] text-body">
              Share the basics. We review every request before scheduling so the
              conversation starts with the right context.
            </p>
            <div className="mt-8 border-t border-line/60 pt-8">
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider">
                Confidential intake // secure submission
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="w-full">
            <AuditForm />
          </Reveal>
        </div>
      </Section>
    </main>
  );
}
