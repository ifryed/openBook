"use client";

import {
  BOOK_LOCALE_OPTIONS,
  bookLocaleLabel,
  filterBookLocaleOptions,
} from "@/lib/book-locales";
import { useMemo, useState } from "react";

type Props = {
  id: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
};

function initialCode(defaultValue: string | undefined): string {
  if (
    defaultValue &&
    BOOK_LOCALE_OPTIONS.some((o) => o.code === defaultValue)
  ) {
    return defaultValue;
  }
  return BOOK_LOCALE_OPTIONS[0]!.code;
}

/**
 * Primary language on create (and wizard). Submitted as hidden `defaultLocale`;
 * searchable list instead of a long native select.
 */
export function BookPrimaryLanguageSelect({
  id,
  name = "defaultLocale",
  defaultValue,
  required = true,
  className = "",
}: Props) {
  const [selected, setSelected] = useState(() => initialCode(defaultValue));
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterBookLocaleOptions(BOOK_LOCALE_OPTIONS, query),
    [query],
  );

  return (
    <div className={className}>
      <input type="hidden" name={name} value={selected} required={required} />
      <p className="mb-2 text-sm text-foreground">
        Selected:{" "}
        <span className="font-medium">
          {bookLocaleLabel(selected)}{" "}
          <span className="font-mono text-xs text-muted">({selected})</span>
        </span>
      </p>
      <label htmlFor={`${id}-search`} className="sr-only">
        Search languages
      </label>
      <input
        id={`${id}-search`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by language or code…"
        autoComplete="off"
        className="mb-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      <ul
        className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border bg-card p-1 text-sm"
        role="listbox"
        aria-label="Languages"
      >
        {filtered.map((o) => {
          const on = o.code === selected;
          return (
            <li key={o.code}>
              <button
                type="button"
                onClick={() => {
                  setSelected(o.code);
                  setQuery("");
                }}
                className={
                  on
                    ? "w-full rounded px-2 py-1.5 text-left font-medium bg-muted text-foreground"
                    : "w-full rounded px-2 py-1.5 text-left text-foreground hover:bg-muted/60"
                }
              >
                {o.label}{" "}
                <span className="font-mono text-xs text-muted">({o.code})</span>
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No languages match your search.</p>
      ) : null}
    </div>
  );
}
