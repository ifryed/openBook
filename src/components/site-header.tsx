import { auth } from "@/auth";
import {
  SiteHeaderAccountMenu,
  SiteHeaderGuestMenu,
} from "@/components/site-header-account-menu";
import { IconEnvelope } from "@/components/site-header-icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { countUnreadNotifications } from "@/lib/notifications";
import { getUserPointsAndTier, type TrustTier } from "@/lib/reputation";
import { isUserSteward } from "@/lib/moderation";
import { getTranslations } from "next-intl/server";

function tierMessageKey(tier: TrustTier): "newcomer" | "contributor" | "steward" {
  switch (tier) {
    case "STEWARD":
      return "steward";
    case "CONTRIBUTOR":
      return "contributor";
    default:
      return "newcomer";
  }
}

export async function SiteHeader() {
  const t = await getTranslations("SiteHeader");
  const tTier = await getTranslations("Tier");
  const session = await auth();

  let unread = 0;
  let points = 0;
  let tierName = "";
  let canResolveReports = false;
  if (session?.user?.id) {
    const uid = session.user.id;
    const [profile, steward, unreadCount] = await Promise.all([
      getUserPointsAndTier(uid),
      isUserSteward(uid),
      countUnreadNotifications(uid),
    ]);
    points = profile.points;
    tierName = tTier(tierMessageKey(profile.tier));
    canResolveReports = steward || session.user.isAdmin;
    unread = unreadCount;
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-foreground no-underline">
          {t("brand")}
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
          <LanguageSwitcher />
          <Link href="/" className="text-muted no-underline hover:underline">
            {t("browse")}
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/books/new"
                className="text-muted no-underline hover:underline"
              >
                {t("addBook")}
              </Link>
              <span
                className="hidden text-muted sm:inline"
                title={t("reputationHint")}
              >
                {tierName} · {points} {t("pts")}
              </span>
              <span className="hidden max-w-[10rem] truncate text-muted sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <div className="flex items-center gap-0.5">
                <Link
                  href="/notifications"
                  className={`relative inline-flex items-center justify-center rounded-md p-2 no-underline transition-colors ${
                    unread > 0
                      ? "bg-accent text-white hover:opacity-90 hover:!text-white"
                      : "bg-transparent text-muted hover:bg-background hover:text-foreground"
                  }`}
                  aria-label={
                    unread > 0
                      ? t("notificationsUnread", {
                          count: unread > 99 ? "99+" : String(unread),
                        })
                      : t("notifications")
                  }
                >
                  <IconEnvelope className="h-5 w-5 shrink-0" />
                </Link>
                <SiteHeaderAccountMenu
                  canResolveReports={canResolveReports}
                  isAdmin={session.user.isAdmin}
                />
              </div>
            </>
          ) : (
            <>
              <SiteHeaderGuestMenu />
              <Link
                href="/signup"
                className="rounded-md bg-accent px-3 py-1.5 !text-white no-underline hover:opacity-90 hover:!text-white"
              >
                {t("signUp")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
