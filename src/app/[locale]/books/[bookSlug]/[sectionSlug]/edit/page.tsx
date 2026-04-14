import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { buildBookContextMarkdown } from "@/lib/book-context";
import {
  bookLocaleHtmlAttributes,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { getLatestRevision } from "@/lib/revisions";
import {
  hasLocalizationTitleForLocale,
  resolveSectionTitle,
} from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { EditSectionForm } from "./edit-section-form";
import { SectionTitleEditor } from "./section-title-editor";
import { BookLangSwitcher } from "@/components/book-lang-switcher";
import type { TranslateFromPrimaryContext } from "@/lib/translate-from-primary";

type Props = {
  params: Promise<{ bookSlug: string; sectionSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function SectionEditPage({ params, searchParams }: Props) {
  const { bookSlug, sectionSlug } = await params;
  const { lang } = await searchParams;

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

  const sectionCount = await prisma.section.count({
    where: { bookId: section.bookId },
  });

  const [bookMeta, allSections] = await Promise.all([
    prisma.book.findUnique({
      where: { id: section.bookId },
      select: {
        title: true,
        figureName: true,
        intendedAges: true,
        defaultLocale: true,
        languages: { select: { locale: true } },
        titleLocales: { select: { locale: true, title: true } },
      },
    }),
    prisma.section.findMany({
      where: { bookId: section.bookId },
      orderBy: { orderIndex: "asc" },
      include: {
        localizations: { select: { locale: true, title: true } },
        revisions: {
          where: { locale: activeLocale },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true },
        },
      },
    }),
  ]);

  const def = bookMeta?.defaultLocale ?? section.book.defaultLocale;
  const bookContextMarkdown = buildBookContextMarkdown(
    allSections.map((s) => ({
      slug: s.slug,
      title: resolveSectionTitle(s.slug, s.localizations, activeLocale, def),
      body: s.revisions[0]?.body ?? "",
    })),
    section.slug,
  );

  const [latest, primaryLatest] = await Promise.all([
    getLatestRevision(section.id, activeLocale),
    getLatestRevision(section.id, def),
  ]);
  const initialBody = latest?.body ?? "";
  const primaryBody = primaryLatest?.body ?? "";
  const primaryTitleRaw =
    section.localizations.find((l) => l.locale === def)?.title?.trim() ?? "";

  const translateFromPrimary: TranslateFromPrimaryContext | null =
    activeLocale !== def
      ? {
          primaryLocale: def,
          activeLocale,
          sourceBody: primaryBody,
          sourceTitle: primaryTitleRaw,
          bodyReady: primaryBody.trim().length > 0,
          titleReady: hasLocalizationTitleForLocale(
            section.localizations,
            def,
          ),
        }
      : null;

  const bookTitleResolved =
    bookMeta != null
      ? resolveBookTitle(
          bookMeta.title,
          bookMeta.titleLocales,
          activeLocale,
          bookMeta.defaultLocale,
        )
      : resolveBookTitle(
          section.book.title,
          section.book.titleLocales,
          activeLocale,
          section.book.defaultLocale,
        );

  return (
    <div className="space-y-6" {...bookLocaleHtmlAttributes(activeLocale)}>
      <BookLangSwitcher locales={bookLocales} activeLocale={activeLocale} />

      <nav className="text-sm text-muted">
        <Link
          href={withLangQuery(
            `/books/${section.book.slug}/${section.slug}`,
            activeLocale,
          )}
          className="text-accent no-underline hover:underline"
        >
          ← {sectionTitle}
        </Link>
      </nav>
      <div>
        <SectionTitleEditor
          bookSlug={section.book.slug}
          sectionSlug={section.slug}
          locale={activeLocale}
          initialTitle={sectionTitle}
          translateFromPrimary={translateFromPrimary}
        />
        <p className="mt-1 text-sm text-muted">
          Editing chapter title for <strong>{activeLocale}</strong>. Markdown
          supported. Each save creates a new revision; nothing is overwritten.
        </p>
      </div>
      <EditSectionForm
        bookSlug={section.book.slug}
        sectionSlug={section.slug}
        locale={activeLocale}
        sectionTitle={sectionTitle}
        initialBody={initialBody}
        canDeleteChapter={sectionCount > 1}
        bookTitle={bookTitleResolved}
        figureName={bookMeta?.figureName ?? ""}
        intendedAges={bookMeta?.intendedAges ?? ""}
        bookContextMarkdown={bookContextMarkdown}
        translateFromPrimary={translateFromPrimary}
      />
    </div>
  );
}
