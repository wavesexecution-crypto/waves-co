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
    slug: "acquisition-os",
    name: "Acquisition OS",
    tagline: "Lead generation, qualification & outreach",
    description: "Automated discovery, verification, scoring and outreach — from lead to qualified pipeline without manual follow-ups.",
    highlights: ["Lead Discovery & Enrichment", "Qualification & Segmentation", "Campaign Workflow with Human Approval"],
    href: "https://dev.wavesco.in/products/acquisition-os",
  },
];

// Deferred products (kept for internal reference, not exposed publicly)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFERRED_PRODUCTS: Product[] = [
  {
    slug: "wavesos",
    name: "WavesOS",
    tagline: "The Operating System for Scale",
    description: "A 3-layer framework that decouples the founder from the day-to-day — Core Logic, Execution Engine, Governance.",
    highlights: ["Layer 1: Core Logic", "Layer 2: Execution Engine", "Layer 3: Governance"],
    href: "https://dev.wavesco.in/products/wavesos",
  },
  {
    slug: "client-os",
    name: "Client OS",
    tagline: "Delivery, projects & operations",
    description: "Client delivery, project intake, and task orchestration — every task has an owner, every handoff is tracked.",
    highlights: ["Project Intake → Delivery", "Task Ownership & Escalation", "Client Status Reporting"],
    href: "https://dev.wavesco.in/products/client-os",
  },
];
