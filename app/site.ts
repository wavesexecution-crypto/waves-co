export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://wavesco.in";

export const siteConfig = {
  name: "WAVES",
  title: "Acquisition OS | WAVES",
  description:
    "Acquisition OS researches your market, finds and verifies prospects, scores them, and runs personalised outreach with your approval before anything sends. Lease from 30 days.",
  url: siteUrl,
  ogImage: `${siteUrl}/og-image.png`,
};


