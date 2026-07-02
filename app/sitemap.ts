import type { MetadataRoute } from "next";
import { siteConfig } from "@/app/site";

const routes = ["", "/case-study", "/architecture-audit"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date("2026-06-30"),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}

