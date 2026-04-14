import { BookDownloadMenu } from "@/components/book-download-menu";
import { isCalibreExportEnabled } from "@/lib/book-export";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";
import {
  buildBookCatalogWhere,
  buildCatalogUrl,
  catalogClearFiltersHref,
  getBookCatalogFilterOptions,
} from "@/lib/catalog-search";
import { resolveBookTitle } from "@/lib/book-title-localization";
import {
  bookLocaleHtmlAttributes,
  bookLocaleLabel,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    figure?: string;
    age?: string;
    country?: string;
    lang?: string;
  }>;
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const c = await getTranslations("Common");

  const {
    q,
    figure: figureParam,
    age: ageParam,
    country: countryParam,
    lang: langParam,
  } = await searchParams;
  const query = q?.trim() ?? "";
  const figureFilter = figureParam?.trim() ?? "";
  const ageFilter = ageParam?.trim() ?? "";
  const countryFilter = countryParam?.trim() ?? "";
  const langFilter = langParam?.trim() ?? "";

  const showCalibreFormats = isCalibreExportEnabled();

  const [filterOptions, books] = await Promise.all([
    getBookCatalogFilterOptions(),
    prisma.book.findMany({
      where: buildBookCatalogWhere({
        query,
        figure: figureFilter,
        age: ageFilter,
        country: countryFilter,
        lang: langFilter,
      }),
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        tags: { include: { tag: true } },
        languages: { select: { locale: true } },
        titleLocales: { select: { locale: true, title: true } },
        _count: { select: { sections: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </div>

      <form className="space-y-4" action={`/${locale}`} method="get">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="q">
            {c("search")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            {c("search")}
          </button>
        </div>

        <details className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {c("filters")}
          </summary>
          <div className="mt-3 flex flex-wrap gap-6">
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">
                {c("ageAudience")}
              </span>
              <IntendedAudienceSelect
                name="age"
                defaultValue={ageFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">
                {c("countryRegion")}
              </span>
              <select
                name="country"
                defaultValue={countryFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">{c("any")}</option>
                {filterOptions.countries.map((co) => (
                  <option key={co} value={co}>
                    {co}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">
                {c("language")}
              </span>
              <select
                name="lang"
                defaultValue={langFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">{c("any")}</option>
                {filterOptions.languages.map((langOpt) => (
                  <option key={langOpt} value={langOpt}>
                    {bookLocaleLabel(langOpt)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">{t("filterHint")}</p>
          <div className="mt-3">
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm !text-white hover:opacity-90"
            >
              {c("applyFilters")}
            </button>
          </div>
        </details>

        {figureFilter ? (
          <input type="hidden" name="figure" value={figureFilter} />
        ) : null}
      </form>

      {figureFilter || ageFilter || countryFilter || langFilter ? (
        <p className="text-sm text-muted">
          {figureFilter ? (
            <>
              {t("activeFiltersFigure")}{" "}
              <span className="font-medium text-foreground">{figureFilter}</span>
            </>
          ) : null}
          {figureFilter && (ageFilter || countryFilter || langFilter)
            ? " · "
            : null}
          {ageFilter ? (
            <>
              {t("activeFiltersAge")}{" "}
              <span className="font-medium text-foreground">{ageFilter}</span>
            </>
          ) : null}
          {(figureFilter || ageFilter) && (countryFilter || langFilter)
            ? " · "
            : null}
          {countryFilter ? (
            <>
              {t("activeFiltersCountry")}{" "}
              <span className="font-medium text-foreground">
                {countryFilter}
              </span>
            </>
          ) : null}
          {(figureFilter || ageFilter || countryFilter) && langFilter
            ? " · "
            : null}
          {langFilter ? (
            <>
              {t("activeFiltersLanguage")}{" "}
              <span className="font-medium text-foreground">
                {bookLocaleLabel(langFilter)}
              </span>
            </>
          ) : null}
          {" · "}
          <Link
            href={catalogClearFiltersHref(locale, query)}
            className="text-accent no-underline hover:underline"
          >
            {c("clearFilters")}
          </Link>
          {query ? (
            <>
              {" · "}
              <Link href={`/${locale}`} className="text-accent no-underline hover:underline">
                {c("clearSearch")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {books.length === 0 ? (
        <p className="text-muted">
          {figureFilter || ageFilter || countryFilter || langFilter || query
            ? t("noBooksMatch")
            : t("noBooksYet")}
        </p>
      ) : (
        <ul className="space-y-4">
          {books.map((book) => {
            const bookLocales = book.languages.map((l) => l.locale);
            const localePreference = langFilter ? langFilter : locale;
            const catalogLocale = normalizeActiveLocale(
              localePreference,
              bookLocales,
              book.defaultLocale,
            );
            const landingLocale = normalizeActiveLocale(
              undefined,
              bookLocales,
              book.defaultLocale,
            );
            const displayTitle = resolveBookTitle(
              book.title,
              book.titleLocales,
              catalogLocale,
              book.defaultLocale,
            );
            const bookHref =
              catalogLocale !== landingLocale
                ? withLangQuery(`/books/${book.slug}`, catalogLocale)
                : `/books/${book.slug}`;

            return (
              <li
                key={book.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div
                  className="flex flex-wrap items-start justify-between gap-3"
                  {...bookLocaleHtmlAttributes(catalogLocale)}
                >
                  <Link
                    href={bookHref}
                    className="min-w-0 flex-1 text-lg font-medium text-foreground no-underline hover:underline"
                  >
                    {displayTitle}
                  </Link>
                  <BookDownloadMenu
                    bookSlug={book.slug}
                    showCalibreFormats={showCalibreFormats}
                    exportLang={catalogLocale}
                  />
                </div>
                <p className="text-sm text-muted">
                  {c("figure")}{" "}
                  <Link
                    href={`/${locale}?figure=${encodeURIComponent(book.figureName)}`}
                    className="text-accent no-underline hover:underline"
                    {...bookLocaleHtmlAttributes(catalogLocale)}
                  >
                    {book.figureName}
                  </Link>
                  {" · "}
                  {book._count.sections} {c("sections")}
                </p>
                {book.country.trim() ? (
                  <p className="mt-1 text-sm text-muted">
                    {c("countryRegion")}
                    {": "}
                    <Link
                      href={`/${locale}?country=${encodeURIComponent(book.country.trim())}`}
                      className="text-accent no-underline hover:underline"
                    >
                      {book.country.trim()}
                    </Link>
                  </p>
                ) : null}
                {book.intendedAges.trim() ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("ageAudienceLabel")}{" "}
                    <Link
                      href={`/${locale}?age=${encodeURIComponent(book.intendedAges.trim())}`}
                      className="text-accent no-underline hover:underline"
                    >
                      {book.intendedAges.trim()}
                    </Link>
                  </p>
                ) : null}
                {book.languages.length > 0 ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>{c("languages")}:</span>
                    {book.languages.map(({ locale: loc }) => (
                      <Link
                        key={loc}
                        href={buildCatalogUrl(locale, {
                          q: query,
                          figure: figureFilter,
                          age: ageFilter,
                          country: countryFilter,
                          lang: loc,
                        })}
                        className="text-accent no-underline hover:underline"
                      >
                        {bookLocaleLabel(loc)}
                      </Link>
                    ))}
                  </p>
                ) : null}
                {book.summary ? (
                  <p
                    className="mt-2 line-clamp-2 text-sm text-foreground"
                    {...bookLocaleHtmlAttributes(catalogLocale)}
                  >
                    {book.summary}
                  </p>
                ) : null}
                {book.tags.length > 0 ? (
                  <p
                    className="mt-2 text-xs text-muted"
                    {...bookLocaleHtmlAttributes(catalogLocale)}
                  >
                    {book.tags.map((bt) => bt.tag.name).join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
