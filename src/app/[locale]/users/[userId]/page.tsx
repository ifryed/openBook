import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { UserProfileContent } from "@/components/user-profile-content";
import { prisma } from "@/lib/db";
import {
  PROFILE_PREVIEW_LIMIT,
  getProfileSectionCounts,
  loadUserProfileCore,
  publicProfileDisplayName,
} from "@/lib/user-profile-data";
import { loadReportProfileLabels } from "@/lib/report-profile-labels";
import { userWatchFormAction } from "@/app/actions/user-watch";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return { title: "Profile" };
  return { title: publicProfileDisplayName(user.name) };
}

export default async function PublicUserProfilePage({ params }: Props) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === userId;

  const [core, sectionCounts, reportLabels, watchingUser] = await Promise.all([
    loadUserProfileCore(userId, PROFILE_PREVIEW_LIMIT, session?.user?.id),
    getProfileSectionCounts(userId, session?.user?.id),
    loadReportProfileLabels(),
    session?.user?.id && session.user.id !== userId
      ? prisma.userWatch.findUnique({
          where: {
            watcherId_watchedUserId: {
              watcherId: session.user.id,
              watchedUserId: userId,
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  const displayName = publicProfileDisplayName(user.name);

  return (
    <div className="space-y-8">
      {isOwner ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
          You are viewing your public profile.{" "}
          <Link
            href="/profile"
            className="text-accent no-underline hover:underline"
          >
            Private dashboard
          </Link>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold">{displayName}</h1>
        <p className="mt-1 text-sm text-muted">Public contributor profile</p>
        {session?.user && !isOwner ? (
          <form action={userWatchFormAction} className="mt-3">
            <input type="hidden" name="watchedUserId" value={userId} />
            <button
              type="submit"
              className="cursor-pointer text-sm text-accent underline-offset-2 hover:underline"
            >
              {watchingUser ? "Unwatch user" : "Watch user"}
            </button>
          </form>
        ) : null}
      </div>
      <UserProfileContent
        variant="public"
        displayName={displayName}
        profile={core.profile}
        books={core.books}
        revisions={core.revisions}
        contributionRows={core.contributionRows}
        reputationEventAtLimit={core.reputationEventAtLimit}
        earnedBadgeIds={core.earnedBadgeIds}
        isPreview
        profileUserId={userId}
        sectionCounts={sectionCounts}
        reportLabels={reportLabels}
      />
    </div>
  );
}
