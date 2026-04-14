import Link from "next/link";
import { tierLabel } from "@/lib/reputation";
import {
  PROFILE_LIST_LIMIT,
  type ProfileCoreData,
  type ProfileFiledReportRow,
  type ProfilePrivateExtras,
} from "@/lib/user-profile-data";
import type { ReputationEventDisplayRow } from "@/lib/reputation-event-display";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type Props = {
  variant: "public" | "private";
  displayName: string;
  profile: ProfileCoreData["profile"];
  books: ProfileCoreData["books"];
  revisions: ProfileCoreData["revisions"];
  contributionRows: ReputationEventDisplayRow[];
  reputationEventAtLimit: boolean;
  privateExtras?: ProfilePrivateExtras;
};

export function UserProfileContent({
  variant,
  displayName,
  profile,
  books,
  revisions,
  contributionRows,
  reputationEventAtLimit,
  privateExtras,
}: Props) {
  const isPrivate = variant === "private";
  const booksTitle = isPrivate ? "Your books" : "Books";
  const booksEmpty = isPrivate ? (
    <p className="text-sm text-muted">
      You have not created a book yet.{" "}
      <Link href="/books/new" className="text-accent no-underline hover:underline">
        Start one
      </Link>
      .
    </p>
  ) : (
    <p className="text-sm text-muted">No books created yet.</p>
  );
  const editsEmpty = isPrivate ? (
    <p className="text-sm text-muted">
      No section revisions yet. Open a book and edit a chapter to contribute.
    </p>
  ) : (
    <p className="text-sm text-muted">No section revisions yet.</p>
  );
  const logEmpty = isPrivate ? (
    <p className="text-sm text-muted">
      Reputation events appear here when your edits and other actions earn
      points (subject to daily caps).
    </p>
  ) : (
    <p className="text-sm text-muted">
      Reputation events from public activity appear here (subject to daily caps).
    </p>
  );
  const booksLimitNote = isPrivate
    ? `Showing your ${PROFILE_LIST_LIMIT} most recently updated books.`
    : `Showing ${PROFILE_LIST_LIMIT} most recently updated books.`;
  const editsLimitNote = isPrivate
    ? `Showing your ${PROFILE_LIST_LIMIT} most recent edits.`
    : `Showing ${PROFILE_LIST_LIMIT} most recent edits.`;
  const logLimitNote = isPrivate
    ? `Showing your ${PROFILE_LIST_LIMIT} most recent contribution events.`
    : `Showing ${PROFILE_LIST_LIMIT} most recent contribution events.`;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">Account</h2>
        <p className="mt-2 text-foreground">{displayName}</p>
        <p className="mt-1 text-sm text-muted">
          {tierLabel(profile.tier)} · {profile.points} reputation points
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{booksTitle}</h2>
        {books.length === 0 ? (
          booksEmpty
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
            {books.length >= PROFILE_LIST_LIMIT ? (
              <p className="text-xs text-muted">{booksLimitNote}</p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Recent edits</h2>
        {revisions.length === 0 ? (
          editsEmpty
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
            {revisions.length >= PROFILE_LIST_LIMIT ? (
              <p className="text-xs text-muted">{editsLimitNote}</p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Contribution log</h2>
        {contributionRows.length === 0 ? (
          logEmpty
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
            {reputationEventAtLimit ? (
              <p className="text-xs text-muted">{logLimitNote}</p>
            ) : null}
          </>
        )}
      </section>

      {isPrivate && privateExtras ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted">Watched books</h2>
            {privateExtras.watches.length === 0 ? (
              <p className="text-sm text-muted">
                You are not watching any books. Use <strong>Watch</strong> on a
                book page to follow edits.
              </p>
            ) : (
              <ul className="space-y-2">
                {privateExtras.watches.map((w) => (
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
            {privateExtras.filedReports.length === 0 ? (
              <p className="text-sm text-muted">
                You have not submitted any reports.
              </p>
            ) : (
              <ul className="space-y-2">
                {privateExtras.filedReports.map((r) => (
                  <FiledReportRow key={r.id} report={r} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function FiledReportRow({ report: r }: { report: ProfileFiledReportRow }) {
  return (
    <li className="rounded-md border border-border bg-card px-3 py-2 text-sm">
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
  );
}
