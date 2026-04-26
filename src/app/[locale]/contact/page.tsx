import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/contact`,
    },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">
          {t("channelHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{t("channelBody")}</p>
        <a
          href="https://github.com/ifryed/openBook/issues"
          className="text-sm text-accent no-underline hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("issuesLinkLabel")}
        </a>
      </section>

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
