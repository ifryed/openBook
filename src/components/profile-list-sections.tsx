import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import {
  publicProfileDisplayName,
  type ProfileBookRow,
  type ProfileFiledReportRow,
  type ProfileRevisionRow,
  type ProfileUserWatchRow,
  type ProfileWatchRow,
} from "@/lib/user-profile-data";
import type { ReportProfileLabels } from "@/lib/report-profile-labels";
import type { ReputationEventDisplayRow } from "@/lib/reputation-event-display";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function ProfileBooksList({
  books,
}: {
  books: ProfileBookRow[];
}) {
  const t = await getTranslations("Drafts");
  return (
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
            {b.isDraft ? (
              <span className="ms-2 rounded border border-border px-1.5 py-0.5 text-xs font-normal text-muted">
                {t("draftBadge")}
              </span>
            ) : null}
          </Link>
          <span className="mt-0.5 block text-xs text-muted">
            Updated {b.updatedAt.toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileRevisionsList({
  revisions,
}: {
  revisions: ProfileRevisionRow[];
}) {
  return (
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
  );
}

export function ProfileContributionsList({
  rows,
}: {
  rows: ReputationEventDisplayRow[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
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
              <span className="font-medium text-foreground">{row.label}</span>
            )}
            <span className="text-muted"> · +{row.delta} pts</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {row.createdAt.toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ProfileWatchesList({ watches }: { watches: ProfileWatchRow[] }) {
  return (
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
  );
}

export function ProfileUserWatchesList({
  userWatches,
}: {
  userWatches: ProfileUserWatchRow[];
}) {
  return (
    <ul className="space-y-2">
      {userWatches.map((w) => (
        <li
          key={w.id}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <Link
            href={`/users/${w.watchedUser.id}`}
            className="font-medium text-foreground no-underline hover:underline"
          >
            {publicProfileDisplayName(w.watchedUser.name)}
          </Link>
          <span className="mt-0.5 block text-xs text-muted">
            Watching since {w.createdAt.toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileReportsList({
  reports,
  labels,
}: {
  reports: ProfileFiledReportRow[];
  labels: ReportProfileLabels;
}) {
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li
          key={r.id}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <p className="text-xs text-muted">
            {r.createdAt.toLocaleString()} ·{" "}
            {r.status === "OPEN" ? (
              <span className="text-foreground">{labels.statusOpen}</span>
            ) : (
              <span className="text-foreground">{labels.statusClosed}</span>
            )}
          </p>
          {r.status === "RESOLVED" && r.disposition ? (
            <p className="mt-1 text-xs text-muted">
              {labels.outcomeLabel}:{" "}
              <span className="text-foreground">
                {labels.dispositions[r.disposition]}
              </span>
            </p>
          ) : null}
          {r.status === "RESOLVED" && r.closePublicSummary ? (
            <p className="mt-1 text-xs text-muted">
              {labels.stewardSummaryLabel}:{" "}
              <span className="text-foreground">{truncate(r.closePublicSummary, 220)}</span>
            </p>
          ) : null}
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
  );
}
