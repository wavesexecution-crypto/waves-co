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
      "Acquisition OS turns your business context into personalised outreach drafts for the prospects you bring in — with a human approval gate before anything is ever sent, and a readable record of every send.",
    highlights: [
      "Contact validation and outreach drafting, run on your own brief",
      "Email verification and lead scoring against your ideal customer",
      "Personalised outreach you approve before a single email sends",
      "Send history and a report you can read",
    ],
    href: "/products/acquisition-os",
  },
];
