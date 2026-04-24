import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OfflineCatalog" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function OfflineCatalogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OfflineCatalog");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("intro")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("whatYouGetHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("whatYouGetP1")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("whatYouGetP2")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("downloadHeading")}
        </h2>
        <p className="text-sm text-muted">{t("downloadHint")}</p>
        <p>
          <a
            href="/api/site/public-catalog.json"
            className="text-accent no-underline hover:underline"
            download
          >
            {t("downloadLink")}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("viewerHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("viewerP1")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("viewerP2")}</p>
      </section>

      <p>
        <Link href="/" className="text-sm text-accent no-underline hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
