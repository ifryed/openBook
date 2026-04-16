import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getBookCatalogFilterOptions() {
  const countryRows = await prisma.book.findMany({
    where: { country: { not: "" }, isDraft: false },
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });

  const langRows = await prisma.bookLanguage.findMany({
    where: { book: { isDraft: false } },
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

  const filters: Prisma.BookWhereInput[] = [{ isDraft: false }];
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
export function catalogClearFiltersHref(locale: string, query: string): string {
  const q = query.trim();
  return q
    ? `/${locale}/?q=${encodeURIComponent(q)}`
    : `/${locale}`;
}

/** Build home catalog URL with only defined filter parts. */
export function buildCatalogUrl(
  locale: string,
  parts: {
    q?: string;
    figure?: string;
    age?: string;
    country?: string;
    lang?: string;
  },
): string {
  const p = new URLSearchParams();
  const add = (key: string, v: string | undefined) => {
    const t = v?.trim();
    if (t) p.set(key, t);
  };
  add("q", parts.q);
  add("figure", parts.figure);
  add("age", parts.age);
  add("country", parts.country);
  add("lang", parts.lang);
  const s = p.toString();
  return s ? `/${locale}/?${s}` : `/${locale}`;
}
