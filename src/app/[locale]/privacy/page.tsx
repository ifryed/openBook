import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

const PRIVACY_SECTIONS = [
  "importantNotice",
  "whoWeAre",
  "informationWeCollect",
  "howWeUse",
  "cookies",
  "advertising",
  "sharing",
  "retention",
  "rights",
  "children",
  "international",
  "changes",
  "contact",
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalPrivacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("LegalPrivacy");

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="space-y-8">
        {PRIVACY_SECTIONS.map((id) => (
          <section key={id} className="space-y-3" id={id}>
            <h2 className="text-lg font-semibold text-foreground">
              {t(`sections.${id}.heading`)}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {t(`sections.${id}.body`)}
            </p>
          </section>
        ))}
      </div>

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </article>
  );
}
