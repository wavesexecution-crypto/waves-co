export type Product = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  href: string;
};

// WAVES sells exactly one product: Acquisition OS. There are no additional
// products, no tiers and no per-seat variants — lease duration is the only
// variable (see lib/leases.ts). Keep this array single-entry so the product
// section and /products/[slug] cannot reintroduce a catalogue.
export const PRODUCTS: Product[] = [
  {
    slug: "acquisition-os",
    name: "Acquisition OS",
    tagline: "Find, qualify and contact your next customers",
    description:
      "Acquisition OS researches your market, discovers and verifies prospects, scores them against your ideal customer, and runs personalised outreach — with a human approval gate before anything is ever sent.",
    highlights: [
      "Market research and prospect discovery, run continuously",
      "Email verification and lead scoring against your ideal customer",
      "Personalised outreach you approve before a single email sends",
      "Reply monitoring, follow-ups and a report you can read",
    ],
    href: "/products/acquisition-os",
  },
];
