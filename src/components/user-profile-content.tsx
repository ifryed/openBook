import Link from "next/link";
import { tierLabel } from "@/lib/reputation";
import {
  ProfileBooksList,
  ProfileContributionsList,
  ProfileReportsList,
  ProfileRevisionsList,
  ProfileWatchesList,
} from "@/components/profile-list-sections";
import {
  PROFILE_LIST_LIMIT,
  PROFILE_PREVIEW_LIMIT,
  type ProfileCoreData,
  type ProfilePrivateExtras,
  type ProfileSectionCounts,
} from "@/lib/user-profile-data";
import type { ReputationEventDisplayRow } from "@/lib/reputation-event-display";

type Props = {
  variant: "public" | "private";
  displayName: string;
  profile: ProfileCoreData["profile"];
  books: ProfileCoreData["books"];
  revisions: ProfileCoreData["revisions"];
  contributionRows: ReputationEventDisplayRow[];
  reputationEventAtLimit: boolean;
  privateExtras?: ProfilePrivateExtras;
  /** Short dashboard: show up to PREVIEW_LIMIT rows plus “View all” when totals exceed it. */
  isPreview: boolean;
  profileUserId: string;
  sectionCounts: ProfileSectionCounts;
};

function ViewAllLink({
  href,
  total,
  label,
}: {
  href: string;
  total: number;
  label: string;
}) {
  if (total <= PROFILE_PREVIEW_LIMIT) return null;
  return (
    <p className="text-sm">
      <Link href={href} className="text-accent no-underline hover:underline">
        View all {total} {label}
      </Link>
    </p>
  );
}

export function UserProfileContent({
  variant,
  displayName,
  profile,
  books,
  revisions,
  contributionRows,
  reputationEventAtLimit,
  privateExtras,
  isPreview,
  profileUserId,
  sectionCounts,
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

  const userBase = `/users/${profileUserId}`;

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
            <ProfileBooksList books={books} />
            {isPreview ? (
              <ViewAllLink
                href={`${userBase}/books`}
                total={sectionCounts.books}
                label="books"
              />
            ) : books.length >= PROFILE_LIST_LIMIT ? (
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
            <ProfileRevisionsList revisions={revisions} />
            {isPreview ? (
              <ViewAllLink
                href={`${userBase}/edits`}
                total={sectionCounts.revisions}
                label="edits"
              />
            ) : revisions.length >= PROFILE_LIST_LIMIT ? (
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
            <ProfileContributionsList rows={contributionRows} />
            {isPreview ? (
              <ViewAllLink
                href={`${userBase}/contributions`}
                total={sectionCounts.contributions}
                label="contributions"
              />
            ) : reputationEventAtLimit ? (
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
              <>
                <ProfileWatchesList watches={privateExtras.watches} />
                {isPreview ? (
                  <ViewAllLink
                    href="/profile/watches"
                    total={sectionCounts.watches}
                    label="watched books"
                  />
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted">Reports you filed</h2>
            {privateExtras.filedReports.length === 0 ? (
              <p className="text-sm text-muted">
                You have not submitted any reports.
              </p>
            ) : (
              <>
                <ProfileReportsList reports={privateExtras.filedReports} />
                {isPreview ? (
                  <ViewAllLink
                    href="/profile/reports"
                    total={sectionCounts.reports}
                    label="reports"
                  />
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
