export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://wavesco.in";

export const siteConfig = {
  name: "Wavesco",
  title: "Wavesco | Systems Architecture for Founder-Led Companies",
  description:
    "Systems architecture for founder-led companies that need work to move without constant founder involvement.",
  url: siteUrl,
  ogImage: `${siteUrl}/og-image.png`,
};

