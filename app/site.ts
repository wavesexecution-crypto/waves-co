export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://wavesco.in";

export const siteConfig = {
  name: "WAVES",
  title: "WAVES | Your business. Made easier.",
  description:
    "WAVES handles the work behind your business, from finding customers to running day-to-day operations.",
  url: siteUrl,
  ogImage: `${siteUrl}/og-image.png`,
};


