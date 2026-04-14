import type { BookLocalization } from "@prisma/client";

type Loc = Pick<BookLocalization, "locale" | "title">;

/**
 * Resolve book title for display: active locale → book default → canonical `Book.title`.
 */
export function resolveBookTitle(
  canonicalTitle: string,
  localizations: Loc[] | undefined,
  activeLocale: string,
  bookDefaultLocale: string,
): string {
  const list = localizations ?? [];
  const byLocale = new Map(list.map((l) => [l.locale, l.title]));
  const pick = (loc: string) => {
    const t = byLocale.get(loc)?.trim();
    return t && t.length > 0 ? t : null;
  };
  return (
    pick(activeLocale) ?? pick(bookDefaultLocale) ?? canonicalTitle.trim()
  );
}
