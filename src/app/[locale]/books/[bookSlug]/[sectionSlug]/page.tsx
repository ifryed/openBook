import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BookLangSwitcher } from "@/components/book-lang-switcher";
import {
  bookLocaleHtmlAttributes,
  bookLocaleLabel,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { getLatestRevision } from "@/lib/revisions";
import {
  isSectionCompleteForLocale,
  resolveSectionTitle,
} from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { MarkdownBody } from "@/components/markdown-body";
import { ReportForm } from "@/components/report-form";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string; bookSlug: string; sectionSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function SectionReadPage({ params, searchParams }: Props) {
  const { locale, bookSlug, sectionSlug } = await params;
  setRequestLocale(locale);
  const { lang } = await searchParams;
  const session = await auth();
  const tBookLog = await getTranslations("BookReportLog");

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      localizations: { select: { locale: true, title: true } },
      book: {
        select: {
          slug: true,
          title: true,
          figureName: true,
          intendedAges: true,
          defaultLocale: true,
          languages: { select: { locale: true } },
          titleLocales: { select: { locale: true, title: true } },
        },
      },
    },
  });

  if (!section) notFound();

  const bookLocales = section.book.languages.map((l) => l.locale);
  const activeLocale = normalizeActiveLocale(
    lang,
    bookLocales,
    section.book.defaultLocale,
  );
  const sectionTitle = resolveSectionTitle(
    section.slug,
    section.localizations,
    activeLocale,
    section.book.defaultLocale,
  );

  const bookTitleDisplay = resolveBookTitle(
    section.book.title,
    section.book.titleLocales,
    activeLocale,
    section.book.defaultLocale,
  );

  const revision = await getLatestRevision(section.id, activeLocale);
  const completeForLocale = isSectionCompleteForLocale(
    section.localizations,
    activeLocale,
    revision?.body,
  );

  if (!completeForLocale) {
    if (!session?.user) {
      notFound();
    }

    const editHref = withLangQuery(
      `/books/${section.book.slug}/${section.slug}/edit`,
      activeLocale,
    );
    const primaryReadHref = withLangQuery(
      `/books/${section.book.slug}/${section.slug}`,
      section.book.defaultLocale,
    );

    return (
      <article
        className="space-y-6"
        {...bookLocaleHtmlAttributes(activeLocale)}
      >
        <BookLangSwitcher locales={bookLocales} activeLocale={activeLocale} />

        <nav className="text-sm text-muted">
          <Link href="/" className="text-accent no-underline hover:underline">
            Home
          </Link>
          {" · "}
          <Link
            href={withLangQuery(`/books/${section.book.slug}`, activeLocale)}
            className="text-accent no-underline hover:underline"
          >
            {bookTitleDisplay}
          </Link>
          {" · "}
          <span>{sectionTitle}</span>
        </nav>

        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">
            This chapter is not available in{" "}
            {bookLocaleLabel(activeLocale)} yet
          </h1>
          <p className="mt-2 text-sm text-muted">
            Readers only see chapters that have both a title and body in a
            language. Add a translation to publish this chapter in{" "}
            {bookLocaleLabel(activeLocale)}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={editHref}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium !text-white no-underline hover:opacity-90"
            >
              Edit chapter ({activeLocale})
            </Link>
            {activeLocale !== section.book.defaultLocale ? (
              <Link
                href={primaryReadHref}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted/40"
              >
                View in {bookLocaleLabel(section.book.defaultLocale)}
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="space-y-6"
      {...bookLocaleHtmlAttributes(activeLocale)}
    >
      <BookLangSwitcher locales={bookLocales} activeLocale={activeLocale} />

      <nav className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          Home
        </Link>
        {" · "}
        <Link
          href={withLangQuery(`/books/${section.book.slug}`, activeLocale)}
          className="text-accent no-underline hover:underline"
        >
          {bookTitleDisplay}
        </Link>
        {" · "}
        <span>{sectionTitle}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">{sectionTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {section.book.figureName}
          </p>
          {section.book.intendedAges.trim() ? (
            <p className="mt-0.5 text-xs text-muted">
              Age / audience: {section.book.intendedAges.trim()}
            </p>
          ) : null}
          {revision ? (
            <p className="mt-2 text-xs text-muted">
              Last edited{" "}
              {revision.createdAt.toLocaleString()} by{" "}
              <Link
                href={`/users/${revision.author.id}`}
                className="text-accent no-underline hover:underline"
              >
                {revision.author.name ?? revision.author.email}
              </Link>
              {revision.summaryComment ? ` · ${revision.summaryComment}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No content in this language yet.</p>
          )}
        </div>
        <div className="shrink-0">
          {session?.user ? (
            <Link
              href={withLangQuery(
                `/books/${section.book.slug}/${section.slug}/edit`,
                activeLocale,
              )}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium !text-white no-underline hover:opacity-90 hover:!text-white hover:!no-underline"
            >
              Edit
            </Link>
          ) : (
            <Link
              href={`/${locale}/login?callbackUrl=${encodeURIComponent(
                `/${locale}${withLangQuery(
                  `/books/${section.book.slug}/${section.slug}/edit`,
                  activeLocale,
                )}`,
              )}`}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted/40"
            >
              Sign in to edit
            </Link>
          )}
        </div>
      </header>

      {revision ? <MarkdownBody content={revision.body} /> : null}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
        <Link
          href={withLangQuery(
            `/books/${section.book.slug}/${section.slug}/history`,
            activeLocale,
          )}
          className="text-accent no-underline hover:underline"
        >
          View history
        </Link>
        <Link
          href={`/books/${section.book.slug}/reports`}
          className="text-accent no-underline hover:underline"
        >
          {tBookLog("linkFromSection")}
        </Link>
      </div>

      {session?.user ? (
        <ReportForm bookSlug={section.book.slug} sectionSlug={section.slug} />
      ) : null}
    </article>
  );
}
