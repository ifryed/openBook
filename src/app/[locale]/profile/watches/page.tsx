import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { redirectToLogin } from "@/lib/auth-redirect";
import { setRequestLocale } from "next-intl/server";
import {
  ProfileUserWatchesList,
  ProfileWatchesList,
} from "@/components/profile-list-sections";
import {
  PROFILE_LIST_LIMIT,
  loadProfileUserWatches,
  loadProfileWatches,
} from "@/lib/user-profile-data";

type Props = { params: Promise<{ locale: string }> };

export default async function ProfileWatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/profile/watches");
  }

  const userId = session.user.id;
  const [watches, userWatches] = await Promise.all([
    loadProfileWatches(userId, PROFILE_LIST_LIMIT),
    loadProfileUserWatches(userId, PROFILE_LIST_LIMIT),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/profile" className="text-accent no-underline hover:underline">
          ← Back to profile
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold">Watches</h1>
        <p className="mt-1 text-sm text-muted">
          Books and contributors you follow for activity notifications, newest
          first.
        </p>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Books</h2>
        {watches.length === 0 ? (
          <p className="text-sm text-muted">
            No watched books. Use <strong>Watch book</strong> on a book page.
          </p>
        ) : (
          <>
            <ProfileWatchesList watches={watches} />
            {watches.length >= PROFILE_LIST_LIMIT ? (
              <p className="text-xs text-muted">
                Showing your {PROFILE_LIST_LIMIT} most recent book watches.
              </p>
            ) : null}
          </>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Contributors</h2>
        {userWatches.length === 0 ? (
          <p className="text-sm text-muted">
            No watched contributors. Use <strong>Watch user</strong> on a public
            profile.
          </p>
        ) : (
          <>
            <ProfileUserWatchesList userWatches={userWatches} />
            {userWatches.length >= PROFILE_LIST_LIMIT ? (
              <p className="text-xs text-muted">
                Showing your {PROFILE_LIST_LIMIT} most recent user watches.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
