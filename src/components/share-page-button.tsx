"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** App routing locale segment (e.g. en), not the book content `lang` query. */
  uiLocale: string;
  /** Path without locale prefix, e.g. `/books/slug` including `?lang=` when needed. */
  pathWithQuery: string;
  shareTitle: string;
  className?: string;
};

export function SharePageButton({
  uiLocale,
  pathWithQuery,
  shareTitle,
  className = "",
}: Props) {
  const t = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  const hideToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopiedToast = useCallback(() => {
    setCopied(true);
    if (hideToastTimer.current) clearTimeout(hideToastTimer.current);
    hideToastTimer.current = setTimeout(() => {
      setCopied(false);
      hideToastTimer.current = null;
    }, 1000);
  }, []);

  const buildUrl = useCallback(() => {
    const path = pathWithQuery.startsWith("/")
      ? pathWithQuery
      : `/${pathWithQuery}`;
    return `${window.location.origin}/${uiLocale}${path}`;
  }, [pathWithQuery, uiLocale]);

  const handleClick = useCallback(async () => {
    const url = buildUrl();

    try {
      await navigator.clipboard.writeText(url);
      showCopiedToast();
    } catch {
      // Non-secure context or permission denied.
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareTitle, url });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
  }, [buildUrl, shareTitle, showCopiedToast]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("share")}
        title={t("share")}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-0.5 text-muted hover:border-border hover:bg-muted/40 hover:text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-[1em] w-[1em] translate-y-px"
          aria-hidden
        >
          <circle cx="18" cy="5" r="2.25" fill="currentColor" />
          <circle cx="6" cy="12" r="2.25" fill="currentColor" />
          <circle cx="18" cy="19" r="2.25" fill="currentColor" />
          <path
            d="M8.3 10.8 15.7 6.4M8.3 13.2 15.7 17.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {copied ? (
        <span
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-md"
        >
          {t("linkCopied")}
        </span>
      ) : null}
    </span>
  );
}
