import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

const OPENBOOK_GITHUB_URL = "https://github.com/ifryed/openBook";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contribute" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ContributePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contribute");

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("missionHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("missionP1")}</p>
        <p className="text-sm leading-relaxed text-muted">{t("missionP2")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t("helpHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("helpIntro")}</p>
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-muted">
          <li>{t("helpBulletGithub")}</li>
          <li>{t("helpBulletLocal")}</li>
          <li>{t("helpBulletLint")}</li>
          <li>{t("helpBulletTranslations")}</li>
        </ul>
        <p>
          <a
            href={OPENBOOK_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent no-underline hover:underline"
          >
            {t("githubLinkLabel")}
          </a>
        </p>
      </section>

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
