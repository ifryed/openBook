import Link from "next/link";
import { auth } from "@/auth";
import { SiteHeaderAccountMenu, SiteHeaderGuestMenu } from "@/components/site-header-account-menu";
import { IconEnvelope } from "@/components/site-header-icons";
import { countUnreadNotifications } from "@/lib/notifications";
import { getUserPointsAndTier, tierLabel } from "@/lib/reputation";
import { isUserSteward } from "@/lib/moderation";

export async function SiteHeader() {
  const session = await auth();

  let unread = 0;
  let points = 0;
  let tierName = "";
  let canResolveReports = false;
  if (session?.user?.id) {
    unread = await countUnreadNotifications(session.user.id);
    const profile = await getUserPointsAndTier(session.user.id);
    points = profile.points;
    tierName = tierLabel(profile.tier);
    const steward = await isUserSteward(session.user.id);
    canResolveReports = steward || session.user.isAdmin;
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-foreground no-underline">
          OpenBook
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
          <Link href="/" className="text-muted no-underline hover:underline">
            Browse
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/books/new"
                className="text-muted no-underline hover:underline"
              >
                New book
              </Link>
              <span
                className="hidden text-muted sm:inline"
                title="Reputation tier and points"
              >
                {tierName} · {points} pts
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
                      ? `Notifications, ${unread > 99 ? "99+" : unread} unread`
                      : "Notifications"
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
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
