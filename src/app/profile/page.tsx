import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserProfileContent } from "@/components/user-profile-content";
import {
  PROFILE_PREVIEW_LIMIT,
  getProfileSectionCounts,
  loadUserProfileCore,
  loadUserProfilePrivate,
} from "@/lib/user-profile-data";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const userId = session.user.id;
  const [core, privateExtras, sectionCounts] = await Promise.all([
    loadUserProfileCore(userId, PROFILE_PREVIEW_LIMIT),
    loadUserProfilePrivate(
      userId,
      PROFILE_PREVIEW_LIMIT,
      PROFILE_PREVIEW_LIMIT,
    ),
    getProfileSectionCounts(userId),
  ]);

  const displayName =
    session.user.name ?? session.user.email ?? "You";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your private dashboard: books, edits, watches, and reports. Others see
          only your{" "}
          <Link
            href={`/users/${userId}`}
            className="text-accent no-underline hover:underline"
          >
            public profile
          </Link>
          . Manage notifications in{" "}
          <Link
            href="/settings"
            className="text-accent no-underline hover:underline"
          >
            settings
          </Link>
          .
        </p>
      </div>

      <UserProfileContent
        variant="private"
        displayName={displayName}
        profile={core.profile}
        books={core.books}
        revisions={core.revisions}
        contributionRows={core.contributionRows}
        reputationEventAtLimit={core.reputationEventAtLimit}
        privateExtras={privateExtras}
        isPreview
        profileUserId={userId}
        sectionCounts={sectionCounts}
      />
    </div>
  );
}
