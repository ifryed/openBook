import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserPointsAndTier, tierLabel } from "@/lib/reputation";
import { toReputationEventDisplayRows } from "@/lib/reputation-event-display";

export const metadata = { title: "Profile" };

const LIST_LIMIT = 50;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const userId = session.user.id;

  const [
    profile,
    books,
    revisions,
    reputationEvents,
    watches,
    filedReports,
  ] = await Promise.all([
    getUserPointsAndTier(userId),
    prisma.book.findMany({
      where: { createdById: userId },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
      select: { id: true, slug: true, title: true, updatedAt: true },
    }),
    prisma.revision.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      select: {
        id: true,
        createdAt: true,
        summaryComment: true,
        section: {
          select: {
            slug: true,
            title: true,
            book: { select: { slug: true, title: true } },
          },
        },
      },
    }),
    prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
    prisma.bookWatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      include: {
        book: { select: { slug: true, title: true, updatedAt: true } },
      },
    }),
    prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        book: { select: { slug: true, title: true } },
        section: { select: { slug: true, title: true } },
      },
    }),
  ]);

  const bookIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const e of reputationEvents) {
    if (e.refBookId) bookIds.add(e.refBookId);
    if (e.refSectionId) sectionIds.add(e.refSectionId);
  }

  const [refBooks, refSections] = await Promise.all([
    bookIds.size
      ? prisma.book.findMany({
          where: { id: { in: [...bookIds] } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    sectionIds.size
      ? prisma.section.findMany({
          where: { id: { in: [...sectionIds] } },
          select: {
            id: true,
            slug: true,
            book: { select: { slug: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const bookById = new Map(refBooks.map((b) => [b.id, { slug: b.slug }]));
  const sectionById = new Map(
    refSections.map((s) => [s.id, { slug: s.slug, book: s.book }]),
  );

  const contributionRows = toReputationEventDisplayRows(
    reputationEvents,
    bookById,
    sectionById,
  );

  const displayName = session.user.name ?? session.user.email ?? "You";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your books, edits, and reputation activity. Manage notifications in{" "}
          <Link href="/settings" className="text-accent no-underline hover:underline">
            settings
          </Link>
          .
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">Account</h2>
        <p className="mt-2 text-foreground">{displayName}</p>
        <p className="mt-1 text-sm text-muted">
          {tierLabel(profile.tier)} · {profile.points} reputation points
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Your books</h2>
        {books.length === 0 ? (
          <p className="text-sm text-muted">
            You have not created a book yet.{" "}
            <Link href="/books/new" className="text-accent no-underline hover:underline">
              Start one
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {books.map((b) => (
                <li
                  key={b.id}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <Link
                    href={`/books/${b.slug}`}
                    className="font-medium text-foreground no-underline hover:underline"
                  >
                    {b.title}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted">
                    Updated {b.updatedAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
            {books.length >= LIST_LIMIT ? (
              <p className="text-xs text-muted">
                Showing your {LIST_LIMIT} most recently updated books.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Recent edits</h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted">
            No section revisions yet. Open a book and edit a chapter to contribute.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {revisions.map((r) => {
                const { book } = r.section;
                return (
                  <li
                    key={r.id}
                    className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <p>
                      <Link
                        href={`/books/${book.slug}/${r.section.slug}`}
                        className="font-medium text-foreground no-underline hover:underline"
                      >
                        {r.section.title}
                      </Link>
                      <span className="text-muted"> · </span>
                      <Link
                        href={`/books/${book.slug}`}
                        className="text-accent no-underline hover:underline"
                      >
                        {book.title}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.createdAt.toLocaleString()}
                      {r.summaryComment
                        ? ` · ${truncate(r.summaryComment, 120)}`
                        : null}
                    </p>
                  </li>
                );
              })}
            </ul>
            {revisions.length >= LIST_LIMIT ? (
              <p className="text-xs text-muted">
                Showing your {LIST_LIMIT} most recent edits.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Contribution log</h2>
        {contributionRows.length === 0 ? (
          <p className="text-sm text-muted">
            Reputation events appear here when your edits and other actions earn
            points (subject to daily caps).
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {contributionRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <p>
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="font-medium text-foreground no-underline hover:underline"
                      >
                        {row.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        {row.label}
                      </span>
                    )}
                    <span className="text-muted"> · +{row.delta} pts</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.createdAt.toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
            {reputationEvents.length >= LIST_LIMIT ? (
              <p className="text-xs text-muted">
                Showing your {LIST_LIMIT} most recent contribution events.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Watched books</h2>
        {watches.length === 0 ? (
          <p className="text-sm text-muted">
            You are not watching any books. Use <strong>Watch</strong> on a book
            page to follow edits.
          </p>
        ) : (
          <ul className="space-y-2">
            {watches.map((w) => (
              <li
                key={w.id}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <Link
                  href={`/books/${w.book.slug}`}
                  className="font-medium text-foreground no-underline hover:underline"
                >
                  {w.book.title}
                </Link>
                <span className="mt-0.5 block text-xs text-muted">
                  Watching since {w.createdAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Reports you filed</h2>
        {filedReports.length === 0 ? (
          <p className="text-sm text-muted">You have not submitted any reports.</p>
        ) : (
          <ul className="space-y-2">
            {filedReports.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <p className="text-xs text-muted">
                  {r.createdAt.toLocaleString()} ·{" "}
                  {r.status === "OPEN" ? (
                    <span className="text-foreground">Open</span>
                  ) : (
                    <span className="text-foreground">Resolved</span>
                  )}
                </p>
                {r.book ? (
                  <p className="mt-2">
                    <Link
                      href={`/books/${r.book.slug}`}
                      className="font-medium text-foreground no-underline hover:underline"
                    >
                      {r.book.title}
                    </Link>
                    {r.section ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link
                          href={`/books/${r.book.slug}/${r.section.slug}`}
                          className="text-accent no-underline hover:underline"
                        >
                          {r.section.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <blockquote className="mt-2 border-l-2 border-border pl-3 text-foreground">
                  {truncate(r.reason, 200)}
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
