import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { getUserPointsAndTier, tierLabel } from "@/lib/reputation";
import { isUserSteward } from "@/lib/moderation";

export async function SiteHeader() {
  const session = await auth();

  let unread = 0;
  let points = 0;
  let tierName = "";
  let showModeration = false;
  if (session?.user?.id) {
    unread = await countUnreadNotifications(session.user.id);
    const profile = await getUserPointsAndTier(session.user.id);
    points = profile.points;
    tierName = tierLabel(profile.tier);
    showModeration = await isUserSteward(session.user.id);
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-foreground no-underline">
          OpenBook
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-muted no-underline hover:underline">
            Browse
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-block text-muted no-underline hover:underline"
              >
                Notifications
                {unread > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/settings"
                className="text-muted no-underline hover:underline"
              >
                Settings
              </Link>
              {showModeration ? (
                <Link
                  href="/moderation/reports"
                  className="text-muted no-underline hover:underline"
                >
                  Moderation
                </Link>
              ) : null}
              <Link
                href="/books/new"
                className="text-muted no-underline hover:underline"
              >
                New book
              </Link>
              <span className="text-muted" title="Reputation tier and points">
                {tierName} · {points} pts
              </span>
              <span className="text-muted">
                {session.user.name ?? session.user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="cursor-pointer text-accent underline-offset-2 hover:underline"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted no-underline hover:underline">
                Sign in
              </Link>
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
