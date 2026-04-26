import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPublicOrigin } from "@/lib/public-origin";

export const runtime = "nodejs";
export const revalidate = 3600;

const STATIC_PATHS = ["", "/mission", "/privacy", "/terms", "/contribute", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getPublicOrigin();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${origin}/${locale}${path}`,
        lastModified: now,
      });
    }
  }

  return entries;
}
