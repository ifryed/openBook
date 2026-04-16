import { bookDownloadRelativeUrl } from "@/lib/book-download-url";

type Props = {
  bookSlug: string;
  showCalibreFormats: boolean;
  /** Export manuscript for this book language (BCP-47 code). */
  exportLang?: string;
  /** e.g. "sm" for list rows */
  summaryClassName?: string;
};

export function BookDownloadMenu({
  bookSlug,
  showCalibreFormats,
  exportLang,
  summaryClassName = "cursor-pointer text-sm text-accent underline-offset-2 hover:underline",
}: Props) {
  return (
    <details className="text-sm">
      <summary className={summaryClassName}>Download</summary>
      <ul className="mt-2 space-y-1 border-l border-border pl-3 text-foreground">
        <li>
          <a
            href={bookDownloadRelativeUrl(bookSlug, "html", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            HTML
          </a>
        </li>
        <li>
          <a
            href={bookDownloadRelativeUrl(bookSlug, "pdf", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            PDF
          </a>
        </li>
        <li>
          <a
            href={bookDownloadRelativeUrl(bookSlug, "epub", exportLang)}
            className="text-accent no-underline hover:underline"
          >
            EPUB
          </a>
        </li>
        {showCalibreFormats ? (
          <>
            <li>
              <a
                href={bookDownloadRelativeUrl(bookSlug, "mobi", exportLang)}
                className="text-accent no-underline hover:underline"
              >
                MOBI (Kindle)
              </a>
            </li>
            <li>
              <a
                href={bookDownloadRelativeUrl(bookSlug, "azw3", exportLang)}
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
