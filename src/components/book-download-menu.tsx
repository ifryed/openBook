type Props = {
  bookSlug: string;
  showCalibreFormats: boolean;
  /** e.g. "sm" for list rows */
  summaryClassName?: string;
};

export function BookDownloadMenu({
  bookSlug,
  showCalibreFormats,
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
            href={`${base}?format=html`}
            className="text-accent no-underline hover:underline"
          >
            HTML
          </a>
        </li>
        <li>
          <a
            href={`${base}?format=pdf`}
            className="text-accent no-underline hover:underline"
          >
            PDF
          </a>
        </li>
        <li>
          <a
            href={`${base}?format=epub`}
            className="text-accent no-underline hover:underline"
          >
            EPUB
          </a>
        </li>
        {showCalibreFormats ? (
          <>
            <li>
              <a
                href={`${base}?format=mobi`}
                className="text-accent no-underline hover:underline"
              >
                MOBI (Kindle)
              </a>
            </li>
            <li>
              <a
                href={`${base}?format=azw3`}
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
