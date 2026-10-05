import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS } from "@/lib/products";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{product.tagline}</p>
      <h1 className="mt-3 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy">{product.name}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-body">{product.description}</p>
      <ul className="mt-8 space-y-2">
        {product.highlights.map((h) => (
          <li key={h} className="flex items-center gap-2 text-sm text-body">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {h}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href={product.slug === "acquisition" ? "/billing" : "/architecture-audit"}
          className="inline-flex h-10 items-center justify-center rounded-sm bg-navy px-5 text-sm font-medium text-white"
        >
          {product.slug === "acquisition" ? "Lease Acquisition OS" : "Start with WAVES"}
        </Link>
        <Link
          href="/#lease"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-line bg-white px-5 text-sm font-medium text-navy"
        >
          View lease options
        </Link>
      </div>
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Acquisition OS is one product. Lease duration is the only variable. No tiers. No auto-renewal.
      </p>
    </div>
  );
}
