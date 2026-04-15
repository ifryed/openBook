import { getTranslations } from "next-intl/server";
import { BADGE_VISUAL, type BadgeId } from "@/lib/badges";

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
    <section className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-lg" aria-hidden>
          🏅
        </span>
        {t("sectionTitle")}
      </h2>
      {earnedBadgeIds.length === 0 ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <span aria-hidden>✨</span>
          <span>{empty}</span>
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {earnedBadgeIds.map((id) => {
            const visual = BADGE_VISUAL[id];
            return (
              <li
                key={id}
                className={`rounded-xl border px-3 py-3 backdrop-blur-sm transition-transform hover:scale-[1.02] ${visual.cardClass}`}
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
      )}
    </section>
  );
}
