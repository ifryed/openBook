import { SITE_CONTENT_LICENSE } from "@/lib/site-content-license";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("SiteFooter");

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t("navAria")}>
          <Link href="/contact" className="text-accent no-underline hover:underline">
            {t("contact")}
          </Link>
          <Link href="/terms" className="text-accent no-underline hover:underline">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="text-accent no-underline hover:underline">
            {t("privacy")}
          </Link>
          <a
            href={SITE_CONTENT_LICENSE.deedUrl}
            className="text-accent no-underline hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("licenseDeed", { license: SITE_CONTENT_LICENSE.shortLabel })}
          </a>
        </nav>
        <p className="text-xs leading-relaxed sm:max-w-md sm:text-end">
          {t.rich("disclaimer", {
            termsLink: (chunks) => (
              <Link href="/terms" className="text-accent no-underline hover:underline">
                {chunks}
              </Link>
            ),
            privacyLink: (chunks) => (
              <Link href="/privacy" className="text-accent no-underline hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
