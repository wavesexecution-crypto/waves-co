import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { LEASES, formatINRRupees } from "@/lib/leases";

// Display uses the locked single source (lib/leases.ts). Trial start is a
// POST API — never link it with GET. Proof entry is via signup.

export function LeasePricing() {
  return (
    <Section id="lease" className="border-t border-line bg-white py-24 sm:py-32">
      <Reveal className="max-w-3xl">
        <Badge>WAVES ONE</Badge>
        <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">WAVES ONE</h2>
        <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
          The system that runs your business. Experience it through a <span className="font-semibold text-navy">2-Day Proof</span> with your own business context, then lease the same system for the duration you need. One product. Lease duration is the only variable.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-sm border border-line bg-paper px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent">2-Day Proof</span>
          <span className="text-sm text-body">No payment required. Your proof work carries into your paid lease.</span>
        </div>
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LEASES.map((l, i) => {
          const rupees = l.pricePaise / 100;
          const monthlyRupees = l.monthlyPaise / 100;
          const saveRupees = l.savePaise / 100;
          return (
          <Reveal key={l.days} delay={i * 0.05}>
            <article className={`premium-card flex h-full flex-col rounded-sm p-8 ${l.days === 30 ? "border-navy/20 bg-paper" : "bg-white"}`}>
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{l.label}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-heading text-[28px] font-semibold tracking-[-0.015em] text-navy">{formatINRRupees(rupees)}</span>
                <span className="text-sm text-muted">/ {l.days} days</span>
              </div>
              <div className="mt-1 text-xs text-muted">Effective {formatINRRupees(monthlyRupees)}/month</div>
              {l.savePaise > 0 ? (
                <div className="mt-3 inline-flex w-fit rounded-sm bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-navy">Save {formatINRRupees(saveRupees)}</div>
              ) : (
                <div className="mt-3 text-xs text-muted">Anchor price</div>
              )}
              <div className="mt-6 flex-1" />
              <Button href={l.days === 30 ? "/signup?from=proof" : `/billing?lease=${l.days}`} variant="secondary" className="mt-6 w-full">
                {l.days === 30 ? "Start 2-Day Proof" : `Lease ${l.days} Days`}
              </Button>
              <p className="mt-3 text-center text-xs leading-4 text-muted">One product. Duration only. No tiers.</p>
            </article>
          </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.2} className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Button href="/signup?from=proof">Start 2-Day Proof — No payment</Button>
        <Button href="/billing" variant="secondary">View lease details</Button>
      </Reveal>
      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">No auto-renewal. Extend explicitly. Proof abuse prevented server-side.</p>
    </Section>
  );
}