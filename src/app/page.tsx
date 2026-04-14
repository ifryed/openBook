import Link from "next/link";
import { BookDownloadMenu } from "@/components/book-download-menu";
import { isCalibreExportEnabled } from "@/lib/book-export";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";
import {
  buildBookCatalogWhere,
  buildCatalogUrl,
  catalogClearFiltersHref,
  getBookCatalogFilterOptions,
} from "@/lib/catalog-search";
import { bookLocaleLabel } from "@/lib/book-locales";
import { prisma } from "@/lib/db";

type Props = {
  searchParams: Promise<{
    q?: string;
    figure?: string;
    age?: string;
    country?: string;
    lang?: string;
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { q, figure: figureParam, age: ageParam, country: countryParam, lang: langParam } =
    await searchParams;
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
        _count: { select: { sections: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Historical figure books
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          OpenBook is a wiki-style library: anyone can sign up, start a book
          about a historical figure, and collaborate with revisions and
          history—like Wikipedia, focused on biographies.
        </p>
      </div>

      <form className="space-y-4" action="/" method="get">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by figure, title, tags, or URL…"
            className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Search
          </button>
        </div>

        <details className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Filters
          </summary>
          <div className="mt-3 flex flex-wrap gap-6">
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">Age / audience</span>
              <IntendedAudienceSelect
                name="age"
                defaultValue={ageFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">
                Country / region
              </span>
              <select
                name="country"
                defaultValue={countryFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                {filterOptions.countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[12rem] text-sm">
              <span className="font-medium text-foreground">Language</span>
              <select
                name="lang"
                defaultValue={langFilter}
                className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                {filterOptions.languages.map((c) => (
                  <option key={c} value={c}>
                    {bookLocaleLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            Country and language options come from books in the library. Age /
            audience uses the standard list on each book.
          </p>
          <div className="mt-3">
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm !text-white hover:opacity-90"
            >
              Apply filters
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
              Figure:{" "}
              <span className="font-medium text-foreground">{figureFilter}</span>
            </>
          ) : null}
          {figureFilter && (ageFilter || countryFilter || langFilter) ? " · " : null}
          {ageFilter ? (
            <>
              Age / audience:{" "}
              <span className="font-medium text-foreground">{ageFilter}</span>
            </>
          ) : null}
          {(figureFilter || ageFilter) && (countryFilter || langFilter) ? " · " : null}
          {countryFilter ? (
            <>
              Country:{" "}
              <span className="font-medium text-foreground">
                {countryFilter}
              </span>
            </>
          ) : null}
          {(figureFilter || ageFilter || countryFilter) && langFilter ? " · " : null}
          {langFilter ? (
            <>
              Language:{" "}
              <span className="font-medium text-foreground">
                {bookLocaleLabel(langFilter)}
              </span>
            </>
          ) : null}
          {" · "}
          <Link
            href={catalogClearFiltersHref(query)}
            className="text-accent no-underline hover:underline"
          >
            Clear filters
          </Link>
          {query ? (
            <>
              {" · "}
              <Link href="/" className="text-accent no-underline hover:underline">
                Clear search
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {books.length === 0 ? (
        <p className="text-muted">
          {figureFilter || ageFilter || countryFilter || langFilter || query
            ? "No books match your search."
            : "No books yet. Sign in and create the first one."}
        </p>
      ) : (
        <ul className="space-y-4">
          {books.map((book) => (
            <li
              key={book.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/books/${book.slug}`}
                  className="min-w-0 flex-1 text-lg font-medium text-foreground no-underline hover:underline"
                >
                  {book.title}
                </Link>
                <BookDownloadMenu
                  bookSlug={book.slug}
                  showCalibreFormats={showCalibreFormats}
                  exportLang={book.defaultLocale}
                />
              </div>
              <p className="text-sm text-muted">
                Figure:{" "}
                <Link
                  href={`/?figure=${encodeURIComponent(book.figureName)}`}
                  className="text-accent no-underline hover:underline"
                >
                  {book.figureName}
                </Link>
                {" · "}
                {book._count.sections} sections
              </p>
              {book.country.trim() ? (
                <p className="mt-1 text-sm text-muted">
                  Country / region:{" "}
                  <Link
                    href={`/?country=${encodeURIComponent(book.country.trim())}`}
                    className="text-accent no-underline hover:underline"
                  >
                    {book.country.trim()}
                  </Link>
                </p>
              ) : null}
              {book.intendedAges.trim() ? (
                <p className="mt-1 text-xs text-muted">
                  Age / audience:{" "}
                  <Link
                    href={`/?age=${encodeURIComponent(book.intendedAges.trim())}`}
                    className="text-accent no-underline hover:underline"
                  >
                    {book.intendedAges.trim()}
                  </Link>
                </p>
              ) : null}
              {book.languages.length > 0 ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>Languages:</span>
                  {book.languages.map(({ locale: loc }) => (
                    <Link
                      key={loc}
                      href={buildCatalogUrl({
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
                <p className="mt-2 line-clamp-2 text-sm text-foreground">
                  {book.summary}
                </p>
              ) : null}
              {book.tags.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {book.tags.map((bt) => bt.tag.name).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
