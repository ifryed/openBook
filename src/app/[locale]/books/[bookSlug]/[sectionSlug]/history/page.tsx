import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { revertSectionFromForm } from "@/app/actions/books";
import { BookLangSwitcher } from "@/components/book-lang-switcher";
import { DiffView } from "@/components/diff-view";
import {
  bookLocaleHtmlAttributes,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { canViewBook } from "@/lib/book-visibility";
import { listRevisions } from "@/lib/revisions";
import { revisionStructuralBadgeFlags } from "@/lib/revision-structural-badges";
import { resolveSectionTitle } from "@/lib/section-localization";
import { resolveBookTitle } from "@/lib/book-title-localization";

type Props = {
  params: Promise<{ bookSlug: string; sectionSlug: string }>;
  searchParams: Promise<{ from?: string; to?: string; lang?: string }>;
};

export default async function SectionHistoryPage({
  params,
  searchParams,
}: Props) {
  const { bookSlug, sectionSlug } = await params;
  const { from: fromId, to: toId, lang } = await searchParams;
  const session = await auth();

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
          isDraft: true,
          createdById: true,
          languages: { select: { locale: true } },
          titleLocales: { select: { locale: true, title: true } },
        },
      },
    },
  });

  if (!section) notFound();
  if (
    !canViewBook(
      {
        isDraft: section.book.isDraft,
        createdById: section.book.createdById,
      },
      session,
    )
  ) {
    notFound();
  }

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

  const revisions = await listRevisions(section.id, activeLocale);

  const fromRev = fromId
    ? revisions.find((r) => r.id === fromId)
    : revisions[1] ?? null;
  const toRev = toId
    ? revisions.find((r) => r.id === toId)
    : revisions[0] ?? null;

  const oldText = fromRev?.body ?? "";
  const newText = toRev?.body ?? "";
  const hasNameDiff =
    toRev != null &&
    toRev.labelDiffBefore != null &&
    toRev.labelDiffAfter != null &&
    (toRev.labelDiffBefore.length > 0 || toRev.labelDiffAfter.length > 0);
  const hasContentDiff = oldText !== newText;

  const historyBase = withLangQuery(
    `/books/${section.book.slug}/${section.slug}/history`,
    activeLocale,
  );

  return (
    <div className="space-y-8" {...bookLocaleHtmlAttributes(activeLocale)}>
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
        <h1 className="text-2xl font-semibold">Revision history</h1>
        <p className="mt-1 text-sm text-muted">
          {bookTitleDisplay} — {sectionTitle} ({activeLocale})
        </p>
      </div>

      {fromRev &&
      toRev &&
      fromRev.id !== toRev.id &&
      (hasContentDiff || hasNameDiff) ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-medium">Diff</h2>
            <p className="text-xs text-muted">
              Comparing older → newer.{" "}
              <Link href={historyBase} className="text-accent">
                Reset to latest pair
              </Link>
            </p>
          </div>
          {hasContentDiff ? (
            <div className="space-y-2">
              <h3 className="text-base font-medium">Content</h3>
              <DiffView oldText={oldText} newText={newText} />
            </div>
          ) : null}
          {hasNameDiff ? (
            <div className="space-y-2">
              <h3 className="text-base font-medium">Names and metadata</h3>
              <DiffView
                oldText={toRev.labelDiffBefore!}
                newText={toRev.labelDiffAfter!}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-medium">Revisions</h2>
        <ul className="mt-3 space-y-3">
          {revisions.map((r, i) => {
            const older = revisions[i + 1];
            const { bookTitleEdit, chapterTitleEdit } =
              revisionStructuralBadgeFlags(
                r.labelDiffBefore,
                r.labelDiffAfter,
              );
            return (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span className="font-medium">
                      {r.createdAt.toLocaleString()}
                    </span>
                    {bookTitleEdit || chapterTitleEdit ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {bookTitleEdit ? (
                          <span
                            className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted"
                            title="This revision includes a book title change"
                          >
                            Book title
                          </span>
                        ) : null}
                        {chapterTitleEdit ? (
                          <span
                            className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted"
                            title="This revision includes a chapter title change"
                          >
                            Chapter title
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/users/${r.author.id}`}
                    className="text-muted no-underline hover:underline"
                  >
                    {r.author.name ?? r.author.email}
                  </Link>
                </div>
                {r.summaryComment ? (
                  <p className="mt-1 text-muted">{r.summaryComment}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {older ? (
                    <Link
                      href={`${historyBase}${historyBase.includes("?") ? "&" : "?"}from=${older.id}&to=${r.id}`}
                      className="text-accent no-underline hover:underline"
                    >
                      Diff vs previous
                    </Link>
                  ) : null}
                  {session?.user && revisions[0]?.id !== r.id ? (
                    <form action={revertSectionFromForm}>
                      <input type="hidden" name="bookSlug" value={bookSlug} />
                      <input
                        type="hidden"
                        name="sectionSlug"
                        value={sectionSlug}
                      />
                      <input type="hidden" name="revisionId" value={r.id} />
                      <input type="hidden" name="locale" value={activeLocale} />
                      <button
                        type="submit"
                        className="cursor-pointer text-accent underline-offset-2 hover:underline"
                      >
                        Revert to this
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
