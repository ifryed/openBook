"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { bookDownloadRelativeUrl } from "@/lib/book-download-url";

type Props = {
  /** App routing locale segment (e.g. en), not the book content `lang` query. */
  uiLocale: string;
  /** Path without locale prefix, e.g. `/books/slug` including `?lang=` when needed. */
  pathWithQuery: string;
  shareTitle: string;
  bookSlug: string;
  /** Book manuscript language for the EPUB export (`lang` query). */
  exportLang: string;
  className?: string;
};

function GlobeWebsiteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 3.75c3.4 2.85 3.4 14.55 0 17.4M12 3.75c-3.4 2.85-3.4 14.55 0 17.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EreaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect
        x="4.5"
        y="2.5"
        width="15"
        height="19"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="6.75"
        y="4.75"
        width="10.5"
        height="12"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M8.25 7.5h7.5M8.25 9.75h7.5M8.25 12h6.25M8.25 14.25h7.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19.25" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function SharePageButton({
  uiLocale,
  pathWithQuery,
  shareTitle,
  bookSlug,
  exportLang,
  className = "",
}: Props) {
  const t = useTranslations("Common");
  const tShare = useTranslations("ShareDialog");
  const [notice, setNotice] = useState<string | null>(null);
  const clearNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (clearNoticeTimer.current) clearTimeout(clearNoticeTimer.current);
    clearNoticeTimer.current = setTimeout(() => {
      setNotice(null);
      clearNoticeTimer.current = null;
    }, 2000);
  }, []);

  const absolutePageUrl = useCallback(() => {
    const path = pathWithQuery.startsWith("/")
      ? pathWithQuery
      : `/${pathWithQuery}`;
    return `${window.location.origin}/${uiLocale}${path}`;
  }, [pathWithQuery, uiLocale]);

  const absoluteEpubUrl = useCallback(() => {
    return `${window.location.origin}${bookDownloadRelativeUrl(
      bookSlug,
      "epub",
      exportLang,
    )}`;
  }, [bookSlug, exportLang]);

  const shareOrCopy = useCallback(
    async (url: string, title: string) => {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ url, title, text: title });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        showNotice(t("linkCopied"));
      } catch {
        // Non-secure context or permission denied.
      }
    },
    [showNotice, t],
  );

  const onSharePage = useCallback(() => {
    void shareOrCopy(absolutePageUrl(), shareTitle);
  }, [absolutePageUrl, shareOrCopy, shareTitle]);

  const onSendEbook = useCallback(() => {
    void shareOrCopy(absoluteEpubUrl(), `${shareTitle} — EPUB`);
  }, [absoluteEpubUrl, shareOrCopy, shareTitle]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <span
        role="group"
        aria-label={t("share")}
        className="inline-flex items-center gap-px rounded-md border border-border bg-card px-0.5 py-0.5 align-middle shadow-sm"
      >
        <span className="group relative inline-flex shrink-0">
          <button
            type="button"
            onClick={onSharePage}
            aria-label={tShare("hoverSharePage")}
            className="inline-flex rounded p-1 text-muted hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <GlobeWebsiteIcon className="h-4 w-4" />
          </button>
          <span
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 max-w-[12rem] -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-center text-xs font-medium leading-snug text-foreground shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
            aria-hidden
          >
            {tShare("hoverSharePage")}
          </span>
        </span>
        <span
          className="my-0.5 w-px shrink-0 self-stretch bg-border"
          aria-hidden
        />
        <span className="group relative inline-flex shrink-0">
          <button
            type="button"
            onClick={onSendEbook}
            aria-label={tShare("hoverSendEbook")}
            className="inline-flex rounded p-1 text-muted hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <EreaderIcon className="h-4 w-4" />
          </button>
          <span
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 max-w-[12rem] -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-center text-xs font-medium leading-snug text-foreground shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
            aria-hidden
          >
            {tShare("hoverSendEbook")}
          </span>
        </span>
      </span>

      {notice ? (
        <span
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-md"
        >
          {notice}
        </span>
      ) : null}
    </span>
  );
}
