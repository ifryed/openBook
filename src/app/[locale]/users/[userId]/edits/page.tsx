import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ProfileRevisionsList } from "@/components/profile-list-sections";
import { prisma } from "@/lib/db";
import {
  PROFILE_LIST_LIMIT,
  loadProfileRevisions,
  publicProfileDisplayName,
} from "@/lib/user-profile-data";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return { title: "Edits" };
  return { title: `${publicProfileDisplayName(user.name)} — Edits` };
}

export default async function UserEditsListPage({ params }: Props) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) notFound();

  const revisions = await loadProfileRevisions(userId, PROFILE_LIST_LIMIT);
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
        <h1 className="text-2xl font-semibold">Recent edits</h1>
        <p className="mt-1 text-sm text-muted">
          Section revisions by {displayName}, newest first.
        </p>
      </div>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted">No edits yet.</p>
      ) : (
        <>
          <ProfileRevisionsList revisions={revisions} />
          {revisions.length >= PROFILE_LIST_LIMIT ? (
            <p className="text-xs text-muted">
              Showing the {PROFILE_LIST_LIMIT} most recent edits.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
