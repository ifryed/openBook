import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileWatchesList } from "@/components/profile-list-sections";
import {
  PROFILE_LIST_LIMIT,
  loadProfileWatches,
} from "@/lib/user-profile-data";

export const metadata = { title: "Watched books" };

export default async function ProfileWatchesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile/watches");
  }

  const userId = session.user.id;
  const watches = await loadProfileWatches(userId, PROFILE_LIST_LIMIT);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/profile" className="text-accent no-underline hover:underline">
          ← Back to profile
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold">Watched books</h1>
        <p className="mt-1 text-sm text-muted">
          Books you follow for edit notifications, newest watches first.
        </p>
      </div>
      {watches.length === 0 ? (
        <p className="text-sm text-muted">
          You are not watching any books. Use <strong>Watch</strong> on a book
          page to follow edits.
        </p>
      ) : (
        <>
          <ProfileWatchesList watches={watches} />
          {watches.length >= PROFILE_LIST_LIMIT ? (
            <p className="text-xs text-muted">
              Showing your {PROFILE_LIST_LIMIT} most recent watches.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
