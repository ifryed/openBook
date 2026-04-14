import type { SectionLocalization } from "@prisma/client";

type Loc = Pick<SectionLocalization, "locale" | "title">;

/** Non-empty localized title for this exact locale (no fallback). */
export function hasLocalizationTitleForLocale(
  localizations: Loc[] | undefined,
  locale: string,
): boolean {
  const list = localizations ?? [];
  const t = list.find((l) => l.locale === locale)?.title?.trim();
  return Boolean(t);
}

/**
 * Published in this locale: localized title exists and latest body is non-empty.
 * Readers only see sections that pass this for the active language.
 */
export function isSectionCompleteForLocale(
  localizations: Loc[] | undefined,
  locale: string,
  latestBody: string | null | undefined,
): boolean {
  return (
    hasLocalizationTitleForLocale(localizations, locale) &&
    Boolean(latestBody?.trim())
  );
}

/**
 * Resolve a section title for display: active locale → book default → first available → slug.
 */
export function resolveSectionTitle(
  slug: string,
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
    pick(activeLocale) ??
    pick(bookDefaultLocale) ??
    (list[0]?.title.trim() || slug)
  );
}
