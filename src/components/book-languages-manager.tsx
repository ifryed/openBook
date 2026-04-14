"use client";

import { addBookLanguage } from "@/app/actions/books";
import {
  BOOK_LOCALE_OPTIONS,
  bookLocaleLabel,
  filterBookLocaleOptions,
  type BookLocaleOption,
} from "@/lib/book-locales";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function BookLanguagesManager({
  bookSlug,
  locales,
  defaultLocale,
}: {
  bookSlug: string;
  locales: string[];
  defaultLocale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availableToAdd: BookLocaleOption[] = BOOK_LOCALE_OPTIONS.filter(
    (o) => !locales.includes(o.code),
  );
  const filteredToAdd = useMemo(
    () => filterBookLocaleOptions(availableToAdd, langSearch),
    [availableToAdd, langSearch],
  );

  const pick = (code: string) => {
    setError(null);
    startTransition(async () => {
      const res = await addBookLanguage(bookSlug, code);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(
        `/books/${bookSlug}/edit/languages/${encodeURIComponent(code)}`,
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Book languages</h2>
          <p className="mt-1 text-xs text-muted">
            Readers only see chapters that have a title and body in each language.
            Add a language, then translate each chapter from its language page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLangSearch("");
            setOpen((v) => !v);
          }}
          disabled={pending || availableToAdd.length === 0}
          className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add language
        </button>
      </div>

      {availableToAdd.length === 0 ? (
        <p className="text-xs text-muted">All supported languages are already added.</p>
      ) : null}

      {open ? (
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-muted">Choose a language to add</p>
          <label htmlFor={`${bookSlug}-add-lang-search`} className="sr-only">
            Search languages to add
          </label>
          <input
            id={`${bookSlug}-add-lang-search`}
            type="search"
            value={langSearch}
            onChange={(e) => setLangSearch(e.target.value)}
            placeholder="Search by language or code…"
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {filteredToAdd.map((o) => (
              <li key={o.code}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(o.code)}
                  className="w-full rounded px-2 py-1.5 text-left text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  {o.label}{" "}
                  <span className="font-mono text-xs text-muted">({o.code})</span>
                </button>
              </li>
            ))}
          </ul>
          {filteredToAdd.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No matches.</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2 text-sm">
        {locales.map((loc) => (
          <li
            key={loc}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
          >
            <span>
              {bookLocaleLabel(loc)}{" "}
              <span className="font-mono text-xs text-muted">({loc})</span>
              {loc === defaultLocale ? (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  Primary
                </span>
              ) : null}
            </span>
            <Link
              href={`/books/${bookSlug}/edit/languages/${encodeURIComponent(loc)}`}
              className="text-accent no-underline hover:underline"
            >
              Edit translations
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
