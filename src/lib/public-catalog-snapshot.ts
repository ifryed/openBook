import { prisma } from "@/lib/db";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { isSectionCompleteForLocale } from "@/lib/section-localization";
import { PUBLIC_CATALOG_QUALITY_WHERE } from "@/lib/catalog-search";

export const PUBLIC_CATALOG_EXPORT_VERSION = 1 as const;

export type PublicCatalogSectionV1 = {
  orderIndex: number;
  slug: string;
  titlesByLocale: Record<string, string>;
  bodiesByLocale: Record<string, string>;
};

export type PublicCatalogBookV1 = {
  slug: string;
  defaultLocale: string;
  figureName: string;
  intendedAges: string;
  country: string;
  summary: string | null;
  locales: string[];
  titlesByLocale: Record<string, string>;
  tags: { slug: string; name: string }[];
  sections: PublicCatalogSectionV1[];
};

export type PublicCatalogSnapshotV1 = {
  v: typeof PUBLIC_CATALOG_EXPORT_VERSION;
  exportedAt: string;
  books: PublicCatalogBookV1[];
};

async function latestRevisionBody(
  sectionId: string,
  locale: string,
): Promise<string | null> {
  const row = await prisma.revision.findFirst({
    where: { sectionId, locale },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  return row?.body ?? null;
}

/**
 * Public, non-draft catalog: metadata and latest section bodies per locale
 * where the section is reader-complete (localized title + non-empty body).
 * No revision history or author PII.
 */
export async function buildPublicCatalogSnapshot(): Promise<PublicCatalogSnapshotV1> {
  const books = await prisma.book.findMany({
    where: PUBLIC_CATALOG_QUALITY_WHERE,
    orderBy: { updatedAt: "desc" },
    include: {
      languages: { select: { locale: true } },
      titleLocales: { select: { locale: true, title: true } },
      tags: { include: { tag: { select: { slug: true, name: true } } } },
      sections: {
        orderBy: { orderIndex: "asc" },
        include: {
          localizations: { select: { locale: true, title: true } },
        },
      },
    },
  });

  const outBooks: PublicCatalogBookV1[] = [];

  for (const book of books) {
    const locales = book.languages.map((l) => l.locale);
    const titleLocales = book.titleLocales;
    const titlesByLocale: Record<string, string> = {};
    for (const loc of locales) {
      titlesByLocale[loc] = resolveBookTitle(
        book.title,
        titleLocales,
        loc,
        book.defaultLocale,
      );
    }

    const sectionsOut: PublicCatalogSectionV1[] = [];

    for (const section of book.sections) {
      const bodiesByLocale: Record<string, string> = {};
      for (const loc of locales) {
        const body = await latestRevisionBody(section.id, loc);
        if (
          isSectionCompleteForLocale(
            section.localizations,
            loc,
            body,
          ) &&
          body
        ) {
          bodiesByLocale[loc] = body.trim();
        }
      }
      if (Object.keys(bodiesByLocale).length === 0) {
        continue;
      }

      const sectionTitles: Record<string, string> = {};
      for (const row of section.localizations) {
        const t = row.title?.trim();
        if (t) sectionTitles[row.locale] = t;
      }

      sectionsOut.push({
        orderIndex: section.orderIndex,
        slug: section.slug,
        titlesByLocale: sectionTitles,
        bodiesByLocale,
      });
    }

    if (sectionsOut.length === 0) {
      continue;
    }

    outBooks.push({
      slug: book.slug,
      defaultLocale: book.defaultLocale,
      figureName: book.figureName,
      intendedAges: book.intendedAges,
      country: book.country,
      summary: book.summary,
      locales,
      titlesByLocale,
      tags: book.tags.map((bt) => ({
        slug: bt.tag.slug,
        name: bt.tag.name,
      })),
      sections: sectionsOut,
    });
  }

  return {
    v: PUBLIC_CATALOG_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    books: outBooks,
  };
}
