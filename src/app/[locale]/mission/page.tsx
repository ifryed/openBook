import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Mission" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function MissionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Mission");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">{t("p1")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("p2")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("p3")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("p4")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("p5")}</p>
      </div>

      <section className="space-y-6 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("contributeSectionHeading")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("contributeSectionIntro")}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {t("contributeStoriesHeading")}
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            {t("contributeStoriesText")}
          </p>
          <p className="text-sm">
            <Link
              href="/signup"
              className="font-medium text-accent no-underline hover:underline"
            >
              {t("contributeStoriesCtaSignUp")}
            </Link>
            <span className="text-muted"> · </span>
            <Link
              href="/books/new"
              className="font-medium text-accent no-underline hover:underline"
            >
              {t("contributeStoriesCtaAddBook")}
            </Link>
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {t("contributeCodeHeading")}
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            {t("contributeCodeText")}
          </p>
          <p>
            <Link
              href="/contribute"
              className="text-sm font-medium text-accent no-underline hover:underline"
            >
              {t("contributeCodeCta")}
            </Link>
          </p>
        </div>
      </section>

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
