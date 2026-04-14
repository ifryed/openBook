import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  bookLocaleHtmlAttributes,
  bookLocaleLabel,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { latestRevisionBodiesForLocale } from "@/lib/section-locale-body";
import {
  isSectionCompleteForLocale,
  resolveSectionTitle,
} from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";
import { BookLocalizedTitleEditor } from "@/components/book-localized-title-editor";
import { EditPencilLink } from "@/components/edit-pencil-link";

type Props = {
  params: Promise<{ bookSlug: string; locale: string }>;
};

export default async function BookLanguageEditPage({ params }: Props) {
  const { bookSlug, locale: localeParam } = await params;
  const locale = decodeURIComponent(localeParam);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/books/${bookSlug}/edit/languages/${encodeURIComponent(localeParam)}`,
      )}`,
    );
  }

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
  if (!book.languages.some((l) => l.locale === locale)) {
    notFound();
  }

  const sectionIds = book.sections.map((s) => s.id);
  const bodies = await latestRevisionBodiesForLocale(sectionIds, locale);

  const bookTitleForLocale = resolveBookTitle(
    book.title,
    book.titleLocales,
    locale,
    book.defaultLocale,
  );

  return (
    <div className="space-y-6" {...bookLocaleHtmlAttributes(locale)}>
      <nav className="text-sm text-muted">
        <Link
          href={`/books/${book.slug}/edit`}
          className="text-accent no-underline hover:underline"
        >
          ← Edit book details
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">
          {bookLocaleLabel(locale)} ({locale})
        </h1>
        <p className="mt-1 text-sm text-muted">
          Chapters without a title and body in this language stay dimmed here and
          are hidden from readers when they view the book in this language. Use
          each row to open the editor for that chapter.
        </p>
      </div>

      <BookLocalizedTitleEditor
        bookSlug={book.slug}
        locale={locale}
        initialTitle={bookTitleForLocale}
      />

      <ol className="list-decimal space-y-2 pl-6 text-sm">
        {book.sections.map((s) => {
          const body = bodies.get(s.id);
          const complete = isSectionCompleteForLocale(
            s.localizations,
            locale,
            body,
          );
          const label = resolveSectionTitle(
            s.slug,
            s.localizations,
            locale,
            book.defaultLocale,
          );
          const editHref = withLangQuery(
            `/books/${book.slug}/${s.slug}/edit`,
            locale,
          );
          return (
            <li key={s.id}>
              <div
                className={
                  complete
                    ? "rounded-md border border-transparent py-1"
                    : "rounded-md border border-dashed border-border bg-muted/20 py-2 pl-2 text-muted-foreground"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={complete ? "text-foreground" : ""}>
                    {label}
                    {!complete ? (
                      <span className="ml-2 text-xs font-normal">
                        — not published in this language
                      </span>
                    ) : null}
                  </span>
                  <EditPencilLink
                    href={editHref}
                    label={complete ? `Edit: ${label}` : `Translate: ${label}`}
                  />
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  /{s.slug}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
