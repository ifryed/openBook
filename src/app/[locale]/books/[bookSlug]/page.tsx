import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminDeleteBookForm } from "@/components/admin-delete-book-form";
import { BookDownloadCount } from "@/components/book-download-count";
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
import { canViewBook } from "@/lib/book-visibility";
import { EditPencilLink } from "@/components/edit-pencil-link";
import { ReportForm } from "@/components/report-form";
import { bookWatchFormAction } from "@/app/actions/book-watch";
import { latestRevisionBodiesForLocale } from "@/lib/section-locale-body";
import {
  isSectionCompleteForLocale,
  resolveSectionTitle,
} from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { SharePageButton } from "@/components/share-page-button";
import { SITE_CONTENT_LICENSE } from "@/lib/site-content-license";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string; bookSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, bookSlug } = await params;
  const book = await prisma.book.findFirst({
    where: { slug: bookSlug, isDraft: false },
    select: {
      title: true,
      titleLocales: { select: { locale: true, title: true } },
      defaultLocale: true,
      figureName: true,
      summary: true,
    },
  });

  if (!book) {
    return {
      alternates: { canonical: `/${locale}/books/${bookSlug}` },
    };
  }

  const localizedTitle = resolveBookTitle(
    book.title,
    book.titleLocales,
    locale,
    book.defaultLocale,
  );

  return {
    title: localizedTitle,
    description: book.summary?.trim() || `Biography of ${book.figureName}`,
    alternates: {
      canonical: `/${locale}/books/${bookSlug}`,
    },
  };
}

export default async function BookPage({ params, searchParams }: Props) {
  const { locale, bookSlug } = await params;
  setRequestLocale(locale);
  const { lang } = await searchParams;
  const session = await auth();
  const tBookLog = await getTranslations("BookReportLog");
  const tLicense = await getTranslations("ContentLicense");
  const showCalibreFormats = isCalibreExportEnabled();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
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
  if (
    !canViewBook(
      { isDraft: book.isDraft, createdById: book.createdById },
      session,
    )
  ) {
    notFound();
  }

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
        <h1 className="flex flex-wrap items-baseline gap-x-1 text-3xl font-semibold leading-snug">
          <span>{displayBookTitle}</span>
          <BookDownloadCount count={book.downloadCount} />
          <SharePageButton
            uiLocale={locale}
            pathWithQuery={withLangQuery(`/books/${book.slug}`, activeLocale)}
            shareTitle={displayBookTitle}
            bookSlug={book.slug}
            exportLang={activeLocale}
            className="ms-1"
          />
        </h1>
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
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {tLicense("bookNoticePrefix")}{" "}
          <a
            href={SITE_CONTENT_LICENSE.deedUrl}
            className="text-accent underline-offset-2 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {tLicense("bookNoticeLicenseLink", {
              label: SITE_CONTENT_LICENSE.shortLabel,
            })}
          </a>
          {tLicense("bookNoticeMid")}{" "}
          <Link href="/terms" className="text-accent underline-offset-2 hover:underline">
            {tLicense("bookNoticeTermsLink")}
          </Link>
          {tLicense("bookNoticeSuffix")}
        </p>
        <p className="mt-4 text-sm text-muted">
          Started by{" "}
          <Link
            href={`/users/${book.createdBy.id}`}
            className="text-accent no-underline hover:underline"
          >
            {book.createdBy.name ?? book.createdBy.email}
          </Link>{" "}
          · Updated {book.updatedAt.toLocaleDateString()}
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
          <Link
            href={`/books/${book.slug}/reports`}
            className="text-sm text-accent no-underline hover:underline"
          >
            {tBookLog("linkFromBook")}
          </Link>
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
