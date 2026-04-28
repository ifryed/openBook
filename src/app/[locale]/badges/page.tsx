import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import {
  BADGE_DEFINITIONS,
  BADGE_VISUAL,
  type BadgeCategory,
  type BadgeId,
} from "@/lib/badges";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

const CATEGORY_ORDER: BadgeCategory[] = [
  "create",
  "edit",
  "community",
  "trust",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Badges" });
  return {
    title: t("catalogMetaTitle"),
    description: t("catalogMetaDescription"),
  };
}

export default async function BadgesCatalogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Badges");

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    ids: BADGE_DEFINITIONS.filter((d) => d.category === category).map(
      (d) => d.id,
    ),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("catalogTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t("catalogIntro")}
        </p>
      </div>

      <div className="space-y-10">
        {byCategory.map(({ category, ids }) => (
          <section key={category} className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t(`catalogCategories.${category}`)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ids.map((id: BadgeId) => {
                const visual = BADGE_VISUAL[id];
                return (
                  <li
                    key={id}
                    className={`rounded-xl border px-3 py-3 backdrop-blur-sm ${visual.cardClass}`}
                  >
                    <div className="flex gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/25 text-2xl shadow-inner dark:bg-black/20"
                        aria-hidden
                      >
                        {visual.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {t(`ids.${id}.title`)}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-foreground/80">
                          {t(`ids.${id}.description`)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          {t("catalogBackHome")}
        </Link>
      </p>
    </div>
  );
}
