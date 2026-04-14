import Link from "next/link";
import { notFound } from "next/navigation";
import { BookLangSwitcher } from "@/components/book-lang-switcher";
import { ContentsOrderPanel } from "@/components/contents-order-panel";
import { LocalLlmTocPanel } from "@/components/local-llm-toc-panel";
import {
  bookLocaleHtmlAttributes,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { resolveSectionTitle } from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { AddSectionForm } from "../../add-section-form";

type Props = {
  params: Promise<{ bookSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function BookEditContentsPage({
  params,
  searchParams,
}: Props) {
  const { bookSlug } = await params;
  const { lang } = await searchParams;

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
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

  const sectionsForPanel = book.sections.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: resolveSectionTitle(
      s.slug,
      s.localizations,
      activeLocale,
      book.defaultLocale,
    ),
  }));

  const bookTitleForLocale = resolveBookTitle(
    book.title,
    book.titleLocales,
    activeLocale,
    book.defaultLocale,
  );

  return (
    <div className="space-y-6" {...bookLocaleHtmlAttributes(activeLocale)}>
      <BookLangSwitcher locales={bookLocales} activeLocale={activeLocale} />

      <nav className="text-sm text-muted">
        <Link
          href={withLangQuery(`/books/${book.slug}`, activeLocale)}
          className="text-accent no-underline hover:underline"
        >
          ← {bookTitleForLocale}
        </Link>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold">Edit contents</h1>
        <p className="mt-1 text-sm text-muted">
          Reorder chapters, add sections, and use optional TOC suggestions.
          Chapter text is edited from each section’s page.
        </p>
      </div>

      <ContentsOrderPanel
        bookSlug={book.slug}
        linkLocale={activeLocale}
        sections={sectionsForPanel}
      />

      <LocalLlmTocPanel
        bookSlug={book.slug}
        bookTitle={bookTitleForLocale}
        figureName={book.figureName}
        intendedAges={book.intendedAges}
        existingSlugs={book.sections.map((s) => s.slug)}
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">Add section</h2>
        <p className="mt-1 text-xs text-muted">
          Each section has its own revision history (Wikipedia-style). New
          sections use the book’s primary language for the first title and draft.
        </p>
        <div className="mt-3">
          <AddSectionForm bookSlug={book.slug} />
        </div>
      </section>
    </div>
  );
}
