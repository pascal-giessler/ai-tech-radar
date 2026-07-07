import type { MetadataRoute } from "next";

import { getLandscape } from "@/lib/api";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { tools, clusters } = await getLandscape();
  const now = new Date();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    ...clusters.map((cluster) => ({
      url: `${SITE_URL}/clusters/${cluster.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...tools.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
