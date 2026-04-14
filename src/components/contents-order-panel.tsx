"use client";

import { reorderBookSections } from "@/app/actions/books";
import { EditPencilLink } from "@/components/edit-pencil-link";
import { withLangQuery } from "@/lib/book-locales";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export type ContentsSectionRow = {
  id: string;
  title: string;
  slug: string;
};

export function ContentsOrderPanel({
  bookSlug,
  linkLocale,
  sections: initialSections,
}: {
  bookSlug: string;
  /** Preserve `?lang=` on chapter links from this screen. */
  linkLocale: string;
  sections: ContentsSectionRow[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const applyMove = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setSections(next);
    setError(null);
    startTransition(async () => {
      const res = await reorderBookSections(
        bookSlug,
        next.map((s) => s.id),
      );
      if (res.error) {
        setError(res.error);
        router.refresh();
        return;
      }
      router.refresh();
    });
  };

  if (sections.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">Table of contents</h2>
        <p className="mt-2 text-xs text-muted">
          No sections yet. Add one below or use suggested contents.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted">Table of contents</h2>
      <p className="mt-1 text-xs text-muted">
        Order matches the book page. Use move up / down to change it.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        {sections.map((s, i) => (
          <li key={s.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex flex-wrap items-center gap-1">
                <Link
                  href={withLangQuery(
                    `/books/${bookSlug}/${s.slug}`,
                    linkLocale,
                  )}
                  className="text-accent no-underline hover:underline"
                >
                  {s.title}
                </Link>
                <EditPencilLink
                  href={withLangQuery(
                    `/books/${bookSlug}/${s.slug}/edit`,
                    linkLocale,
                  )}
                  label={`Edit chapter: ${s.title}`}
                />
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => applyMove(i, i - 1)}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move “${s.title}” up`}
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={pending || i === sections.length - 1}
                  onClick={() => applyMove(i, i + 1)}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Move “${s.title}” down`}
                >
                  Down
                </button>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
