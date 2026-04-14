import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ProfileContributionsList } from "@/components/profile-list-sections";
import { prisma } from "@/lib/db";
import {
  PROFILE_LIST_LIMIT,
  loadProfileContributionRows,
  publicProfileDisplayName,
} from "@/lib/user-profile-data";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return { title: "Contributions" };
  return { title: `${publicProfileDisplayName(user.name)} — Contributions` };
}

export default async function UserContributionsListPage({ params }: Props) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) notFound();

  const { rows, reputationEventAtLimit } = await loadProfileContributionRows(
    userId,
    PROFILE_LIST_LIMIT,
  );
  const displayName = publicProfileDisplayName(user.name);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href={`/users/${userId}`}
          className="text-accent no-underline hover:underline"
        >
          ← Back to {displayName}
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold">Contribution log</h1>
        <p className="mt-1 text-sm text-muted">
          Reputation events for {displayName}, newest first (subject to daily
          caps).
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No contribution events yet.</p>
      ) : (
        <>
          <ProfileContributionsList rows={rows} />
          {reputationEventAtLimit ? (
            <p className="text-xs text-muted">
              Showing the {PROFILE_LIST_LIMIT} most recent events.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
