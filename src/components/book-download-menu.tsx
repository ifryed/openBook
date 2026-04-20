import { IconDownload } from "@/components/site-header-icons";
import { bookDownloadRelativeUrl } from "@/lib/book-download-url";
import { getTranslations } from "next-intl/server";

type Props = {
  bookSlug: string;
  showCalibreFormats: boolean;
  /** Export manuscript for this book language (BCP-47 code). */
  exportLang?: string;
  /** Classes for the clickable summary control (icon). */
  summaryClassName?: string;
};

export async function BookDownloadMenu({
  bookSlug,
  showCalibreFormats,
  exportLang,
  summaryClassName = "cursor-pointer rounded p-0.5 text-accent outline-offset-2 hover:bg-muted/60",
}: Props) {
  const t = await getTranslations("BookDownload");
  return (
    <details className="text-sm">
      <summary
        className={`${summaryClassName} inline-flex list-none items-center justify-center [&::-webkit-details-marker]:hidden`}
        aria-label={t("label")}
      >
        <IconDownload className="h-5 w-5 shrink-0" />
      </summary>
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
