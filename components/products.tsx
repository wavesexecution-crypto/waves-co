import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { PRODUCTS } from "@/lib/products";

/** Single-product section. WAVES sells Acquisition OS and nothing else, so this
 *  presents one product rather than a catalogue. */
export function Products() {
  const product = PRODUCTS[0]!;

  return (
    <Section id="products" className="py-24 sm:py-32">
      <Reveal className="max-w-3xl">
        <Badge>The product</Badge>
        <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
          One product. It finds and wins you customers.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
          WAVES sells Acquisition OS. It is a complete system for outbound acquisition — not a bundle of separate
          tools, and not a tier you upgrade through.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-16 max-w-3xl">
        <article className="premium-card flex h-full flex-col rounded-sm p-8">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">{product.tagline}</div>
          <h3 className="mt-3 font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[24px]">
            {product.name}
          </h3>
          <p className="mt-3 flex-grow text-sm leading-7 text-body">{product.description}</p>
          <ul className="mt-6 space-y-2">
            {product.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-body">
                <span className="h-1 w-1 rounded-full bg-accent" />
                {h}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button href={product.href} variant="secondary" className="w-full">
              How Acquisition OS works
            </Button>
          </div>
        </article>
      </Reveal>

      <Reveal delay={0.1} className="mt-12 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Lease duration is the only variable · No tiers · No auto-renewal
        </p>
      </Reveal>
    </Section>
  );
}
