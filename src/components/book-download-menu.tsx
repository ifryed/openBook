type Props = {
  bookSlug: string;
  showCalibreFormats: boolean;
  /** Export manuscript for this book language (BCP-47 code). */
  exportLang?: string;
  /** e.g. "sm" for list rows */
  summaryClassName?: string;
};

function downloadHref(
  base: string,
  format: string,
  exportLang: string | undefined,
): string {
  const q = new URLSearchParams({ format });
  const l = exportLang?.trim();
  if (l) q.set("lang", l);
  return `${base}?${q.toString()}`;
}

export function BookDownloadMenu({
  bookSlug,
  showCalibreFormats,
  exportLang,
  summaryClassName = "cursor-pointer text-sm text-accent underline-offset-2 hover:underline",
}: Props) {
  const enc = encodeURIComponent(bookSlug);
  const base = `/api/books/${enc}/download`;

  return (
    <details className="text-sm">
      <summary className={summaryClassName}>Download</summary>
      <ul className="mt-2 space-y-1 border-l border-border pl-3 text-foreground">
        <li>
          <a
            href={downloadHref(base, "html", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            HTML
          </a>
        </li>
        <li>
          <a
            href={downloadHref(base, "pdf", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            PDF
          </a>
        </li>
        <li>
          <a
            href={downloadHref(base, "epub", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            EPUB
          </a>
        </li>
        {showCalibreFormats ? (
          <>
            <li>
              <a
                href={downloadHref(base, "mobi", exportLang)}
                className="text-accent no-underline hover:underline"
              >
                MOBI (Kindle)
              </a>
            </li>
            <li>
              <a
                href={downloadHref(base, "azw3", exportLang)}
                className="text-accent no-underline hover:underline"
              >
                AZW3 (Kindle)
              </a>
            </li>
          </>
        ) : null}
      </ul>
    </details>
  );
}
