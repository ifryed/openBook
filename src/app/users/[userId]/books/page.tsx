import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileBooksList } from "@/components/profile-list-sections";
import { prisma } from "@/lib/db";
import {
  PROFILE_LIST_LIMIT,
  loadProfileBooks,
  publicProfileDisplayName,
} from "@/lib/user-profile-data";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return { title: "Books" };
  return { title: `${publicProfileDisplayName(user.name)} — Books` };
}

export default async function UserBooksListPage({ params }: Props) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) notFound();

  const books = await loadProfileBooks(userId, PROFILE_LIST_LIMIT);
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
        <h1 className="text-2xl font-semibold">Books</h1>
        <p className="mt-1 text-sm text-muted">
          Books created by {displayName}, most recently updated first.
        </p>
      </div>
      {books.length === 0 ? (
        <p className="text-sm text-muted">No books yet.</p>
      ) : (
        <>
          <ProfileBooksList books={books} />
          {books.length >= PROFILE_LIST_LIMIT ? (
            <p className="text-xs text-muted">
              Showing the {PROFILE_LIST_LIMIT} most recently updated books.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
