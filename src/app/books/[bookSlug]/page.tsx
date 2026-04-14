import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminDeleteBookForm } from "@/components/admin-delete-book-form";
import { BookDownloadMenu } from "@/components/book-download-menu";
import { BookLangSwitcher } from "@/components/book-lang-switcher";
import { isCalibreExportEnabled } from "@/lib/book-export";
import {
  bookLocaleHtmlAttributes,
  bookLocaleLabel,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { EditPencilLink } from "@/components/edit-pencil-link";
import { ReportForm } from "@/components/report-form";
import { bookWatchFormAction } from "@/app/actions/book-watch";
import { latestRevisionBodiesForLocale } from "@/lib/section-locale-body";
import {
  isSectionCompleteForLocale,
  resolveSectionTitle,
} from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";

type Props = {
  params: Promise<{ bookSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function BookPage({ params, searchParams }: Props) {
  const { bookSlug } = await params;
  const { lang } = await searchParams;
  const session = await auth();
  const showCalibreFormats = isCalibreExportEnabled();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      createdBy: { select: { name: true, email: true } },
      tags: { include: { tag: true } },
      languages: { select: { locale: true } },
      titleLocales: { select: { locale: true, title: true } },
      sections: {
        orderBy: { orderIndex: "asc" },
        include: {
          localizations: { select: { locale: true, title: true } },
        },
      },
    },
  });

  if (!book) notFound();

  const bookLocales = book.languages.map((l) => l.locale);
  const activeLocale = normalizeActiveLocale(
    lang,
    bookLocales,
    book.defaultLocale,
  );

  const sectionIds = book.sections.map((s) => s.id);
  const bodiesBySection = await latestRevisionBodiesForLocale(
    sectionIds,
    activeLocale,
  );
  const visibleSections = book.sections.filter((s) =>
    isSectionCompleteForLocale(
      s.localizations,
      activeLocale,
      bodiesBySection.get(s.id),
    ),
  );

  const displayBookTitle = resolveBookTitle(
    book.title,
    book.titleLocales,
    activeLocale,
    book.defaultLocale,
  );

  let watching = false;
  if (session?.user?.id) {
    const w = await prisma.bookWatch.findUnique({
      where: {
        userId_bookId: { userId: session.user.id, bookId: book.id },
      },
    });
    watching = !!w;
  }

  return (
    <div className="space-y-8" {...bookLocaleHtmlAttributes(activeLocale)}>
      <BookLangSwitcher locales={bookLocales} activeLocale={activeLocale} />

      <div>
        <h1 className="text-3xl font-semibold">{displayBookTitle}</h1>
        <p className="mt-1 text-lg text-muted">{book.figureName}</p>
        {book.intendedAges.trim() ? (
          <p className="mt-1 text-sm text-muted">
            Age / audience: {book.intendedAges.trim()}
          </p>
        ) : null}
        {book.country.trim() ? (
          <p className="mt-1 text-sm text-muted">
            Country / region: {book.country.trim()}
          </p>
        ) : null}
        {bookLocales.length > 0 ? (
          <p className="mt-1 text-sm text-muted">
            Languages:{" "}
            {bookLocales.map((c) => bookLocaleLabel(c)).join(" · ")}
          </p>
        ) : null}
        {book.summary ? (
          <p className="mt-4 text-foreground">{book.summary}</p>
        ) : null}
        <p className="mt-4 text-sm text-muted">
          Started by {book.createdBy.name ?? book.createdBy.email} · Updated{" "}
          {book.updatedAt.toLocaleDateString()}
        </p>
        {book.tags.length > 0 ? (
          <p className="mt-2 text-sm text-muted">
            {book.tags.map((bt) => bt.tag.name).join(" · ")}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <BookDownloadMenu
            bookSlug={book.slug}
            exportLang={activeLocale}
            showCalibreFormats={showCalibreFormats}
          />
          {session?.user ? (
            <>
              <Link
                href={`/books/${book.slug}/edit`}
                className="text-sm text-accent no-underline hover:underline"
              >
                Edit book details
              </Link>
              <form action={bookWatchFormAction}>
                <input type="hidden" name="bookSlug" value={book.slug} />
                <button
                  type="submit"
                  className="cursor-pointer text-sm text-accent underline-offset-2 hover:underline"
                >
                  {watching ? "Unwatch book" : "Watch book"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">Contents</h2>
          {session?.user ? (
            <EditPencilLink
              href={withLangQuery(
                `/books/${book.slug}/edit/contents`,
                activeLocale,
              )}
              label="Edit table of contents"
            />
          ) : null}
        </div>
        {visibleSections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No chapters are available in this language yet.
            {session?.user ? (
              <>
                {" "}
                <Link
                  href={`/books/${book.slug}/edit/languages/${encodeURIComponent(activeLocale)}`}
                  className="text-accent no-underline hover:underline"
                >
                  Add translations
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-6">
            {visibleSections.map((s) => {
              const title = resolveSectionTitle(
                s.slug,
                s.localizations,
                activeLocale,
                book.defaultLocale,
              );
              return (
                <li key={s.id}>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <Link
                      href={withLangQuery(
                        `/books/${book.slug}/${s.slug}`,
                        activeLocale,
                      )}
                      className="text-accent no-underline hover:underline"
                    >
                      {title}
                    </Link>
                    {session?.user ? (
                      <EditPencilLink
                        href={withLangQuery(
                          `/books/${book.slug}/${s.slug}/edit`,
                          activeLocale,
                        )}
                        label={`Edit chapter: ${title}`}
                      />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {session?.user ? (
        <ReportForm bookSlug={book.slug} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login">Sign in</Link> to report issues with this book.
        </p>
      )}

      {session?.user?.isAdmin ? (
        <AdminDeleteBookForm bookSlug={book.slug} bookTitle={book.title} />
      ) : null}
    </div>
  );
}
