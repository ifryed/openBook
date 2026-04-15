import { getTranslations } from "next-intl/server";
import type { BadgeId } from "@/lib/badges";

type Props = {
  earnedBadgeIds: BadgeId[];
  /** Private profile: slightly different empty copy */
  variant: "public" | "private";
};

export async function ProfileBadges({ earnedBadgeIds, variant }: Props) {
  const t = await getTranslations("Badges");
  const empty =
    variant === "private"
      ? t("emptyPrivate")
      : t("emptyPublic");

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted">{t("sectionTitle")}</h2>
      {earnedBadgeIds.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {earnedBadgeIds.map((id) => (
            <li
              key={id}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <p className="text-sm font-medium text-foreground">
                {t(`ids.${id}.title`)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t(`ids.${id}.description`)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
