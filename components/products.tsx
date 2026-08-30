import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { PRODUCTS } from "@/lib/products";

export function Products() {
  return (
    <Section id="products" className="py-24 sm:py-32">
      <Reveal className="max-w-3xl">
        <Badge>Products</Badge>
        <h2 className="mt-6 font-heading text-[32px] font-semibold leading-[1.2] tracking-[-0.015em] text-navy sm:text-[40px]">
          Systems you can <span className="text-accent">run</span>, not slides you buy.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-body">
          The same operating systems we install for founder-led companies — available as products. Clean handoffs, decision rights, and review loops, not tool sprawl.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {PRODUCTS.map((p, i) => (
          <Reveal key={p.slug} delay={i * 0.05}>
            <article className="premium-card flex h-full flex-col rounded-sm p-8">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">{p.tagline}</div>
              <h3 className="mt-3 font-heading text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-navy sm:text-[24px]">{p.name}</h3>
              <p className="mt-3 flex-grow text-sm leading-7 text-body">{p.description}</p>
              <ul className="mt-6 space-y-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-sm text-body">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button href={p.href} variant="secondary" className="w-full">
                  Explore {p.name} →
                </Button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-12 flex flex-col gap-4 sm:flex-row">
        <Button href="https://dev.wavesco.in/products">Explore all products on dev.wavesco.in →</Button>
        <Button href="https://dev.wavesco.in/products/wavesos" variant="secondary">
          WavesOS details
        </Button>
      </Reveal>
    </Section>
  );
}
