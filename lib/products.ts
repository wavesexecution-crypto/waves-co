export type Product = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  href: string;
};

// Active public products
export const PRODUCTS: Product[] = [
  {
    slug: "acquisition",
    name: "WAVES Acquisition",
    tagline: "Find your next customers",
    description: "Automated discovery, verification, scoring and outreach — from lead to qualified pipeline without manual follow-ups.",
    highlights: ["Lead Discovery & Enrichment", "Qualification & Segmentation", "Campaign Workflow with Human Approval"],
    href: "/products/acquisition",
  },
  {
    slug: "studio",
    name: "WAVES Studio",
    tagline: "Create your content",
    description: "Generate, edit, and publish content across channels. Brand-consistent output at scale without a creative team.",
    highlights: ["Multi-channel Content Generation", "Brand Voice & Style Control", "Approval Workflows"],
    href: "/products/studio",
  },
  {
    slug: "automation",
    name: "WAVES Automation",
    tagline: "Put repetitive work on autopilot",
    description: "Connect your tools, define rules, and let WAVES handle the routine. Approvals, routing, reminders — done.",
    highlights: ["Cross-tool Workflows", "Conditional Logic & Routing", "Human-in-the-loop Approvals"],
    href: "/products/automation",
  },
];

// Deferred products (kept for internal reference, not exposed publicly)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFERRED_PRODUCTS: Product[] = [];