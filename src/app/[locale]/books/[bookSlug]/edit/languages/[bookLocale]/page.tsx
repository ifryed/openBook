import { Link } from "@/i18n/navigation";
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
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string; bookSlug: string; bookLocale: string }>;
};

export default async function BookLanguageEditPage({ params }: Props) {
  const { locale: uiLocale, bookSlug, bookLocale: bookLocaleParam } =
    await params;
  setRequestLocale(uiLocale);
  const t = await getTranslations("BookLanguageEdit");

  const bookLang = decodeURIComponent(bookLocaleParam);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/${uiLocale}/login?callbackUrl=${encodeURIComponent(
        `/${uiLocale}/books/${bookSlug}/edit/languages/${encodeURIComponent(bookLocaleParam)}`,
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
  if (!book.languages.some((l) => l.locale === bookLang)) {
    notFound();
  }

  const sectionIds = book.sections.map((s) => s.id);
  const bodies = await latestRevisionBodiesForLocale(sectionIds, bookLang);

  const bookTitleForLocale = resolveBookTitle(
    book.title,
    book.titleLocales,
    bookLang,
    book.defaultLocale,
  );

  return (
    <div className="space-y-6" {...bookLocaleHtmlAttributes(bookLang)}>
      <nav className="text-sm text-muted">
        <Link
          href={`/books/${book.slug}/edit`}
          className="text-accent no-underline hover:underline"
        >
          {t("backToEdit")}
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">
          {bookLocaleLabel(bookLang)} ({bookLang})
        </h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      <BookLocalizedTitleEditor
        bookSlug={book.slug}
        locale={bookLang}
        initialTitle={bookTitleForLocale}
      />

      <ol className="list-decimal space-y-2 pl-6 text-sm">
        {book.sections.map((s) => {
          const body = bodies.get(s.id);
          const complete = isSectionCompleteForLocale(
            s.localizations,
            bookLang,
            body,
          );
          const label = resolveSectionTitle(
            s.slug,
            s.localizations,
            bookLang,
            book.defaultLocale,
          );
          const editHref = withLangQuery(
            `/books/${book.slug}/${s.slug}/edit`,
            bookLang,
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
                        {t("notPublished")}
                      </span>
                    ) : null}
                  </span>
                  <EditPencilLink
                    href={editHref}
                    label={
                      complete
                        ? t("editChapter", { title: label })
                        : t("translateChapter", { title: label })
                    }
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
