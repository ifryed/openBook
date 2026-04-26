import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { routing } from "@/i18n/routing";
import { getPublicOrigin } from "@/lib/public-origin";

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

  const books = await prisma.book.findMany({
    where: { isDraft: false },
    select: {
      slug: true,
      updatedAt: true,
      sections: { select: { slug: true } },
    },
  });

  for (const book of books) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${origin}/${locale}/books/${book.slug}`,
        lastModified: book.updatedAt,
      });
      for (const section of book.sections) {
        entries.push({
          url: `${origin}/${locale}/books/${book.slug}/${section.slug}`,
          lastModified: book.updatedAt,
        });
      }
    }
  }

  return entries;
}
