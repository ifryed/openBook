import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const PUBLIC_CATALOG_QUALITY_WHERE: Prisma.BookWhereInput = {
  isDraft: false,
  sections: { some: {} },
};

export async function getBookCatalogFilterOptions() {
  const countryRows = await prisma.book.findMany({
    where: {
      ...PUBLIC_CATALOG_QUALITY_WHERE,
      country: { not: "" },
    },
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });

  const langRows = await prisma.bookLanguage.findMany({
    where: { book: PUBLIC_CATALOG_QUALITY_WHERE },
    select: { locale: true },
    distinct: ["locale"],
    orderBy: { locale: "asc" },
  });

  return {
    countries: countryRows.map((r) => r.country),
    languages: langRows.map((r) => r.locale),
  };
}

export function buildBookCatalogWhere(input: {
  query: string;
  figure: string;
  age: string;
  country: string;
  lang: string;
}): Prisma.BookWhereInput | undefined {
  const q = input.query.trim();
  const figureF = input.figure.trim();
  const ageF = input.age.trim();
  const countryF = input.country.trim();
  const langF = input.lang.trim();

  const searchWhere: Prisma.BookWhereInput | null = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { figureName: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          {
            tags: {
              some: {
                tag: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { slug: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ],
      }
    : null;

  const filters: Prisma.BookWhereInput[] = [PUBLIC_CATALOG_QUALITY_WHERE];
  if (figureF) {
    filters.push({ figureName: { equals: figureF, mode: "insensitive" } });
  }
  if (ageF) {
    filters.push({ intendedAges: { equals: ageF, mode: "insensitive" } });
  }
  if (countryF) {
    filters.push({ country: { equals: countryF, mode: "insensitive" } });
  }
  if (langF) {
    filters.push({
      languages: { some: { locale: { equals: langF, mode: "insensitive" } } },
    });
  }

  if (!searchWhere) {
    return filters.length === 1 ? filters[0]! : { AND: filters };
  }
  return { AND: [...filters, searchWhere] };
}

/** Drop figure / age / country / lang params but keep text search `q`. */
export function catalogClearFiltersHref(query: string): string {
  const q = query.trim();
  return q ? `/?q=${encodeURIComponent(q)}` : "/";
}
