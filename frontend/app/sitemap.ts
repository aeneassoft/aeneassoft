import type { MetadataRoute } from "next";

const BASE = "https://aeneassoft.com";
const LOCALES = ["en", "de"];

const PUBLIC_ROUTES = [
  { path: "", priority: 1.0 },
  { path: "/pricing", priority: 0.9 },
  { path: "/product", priority: 0.8 },
  { path: "/docs", priority: 0.8 },
  { path: "/playground", priority: 0.7 },
  { path: "/about", priority: 0.5 },
  { path: "/contact", priority: 0.5 },
  { path: "/blog", priority: 0.5 },
  { path: "/investors", priority: 0.4 },
  { path: "/legal/imprint", priority: 0.3 },
  { path: "/legal/privacy", priority: 0.3 },
  { path: "/legal/terms", priority: 0.3 },
  { path: "/legal/dpa", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const route of PUBLIC_ROUTES) {
      entries.push({
        url: `${BASE}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: route.priority,
      });
    }
  }

  return entries;
}
