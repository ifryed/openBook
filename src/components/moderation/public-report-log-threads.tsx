import type { ReportDisposition } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import type {
  PublicReportLogRow,
  PublicReportLogThread,
} from "@/lib/public-report-log";

export type PublicReportLogThreadLabels = {
  reporterMessage: string;
  by: string;
  target: string;
  disposition: string;
  kindDisposition: string;
  kindPublicComment: string;
  kindReportFiled: string;
  followUps: string;
  expandThread: string;
};

function entryKindLabel(kind: string, labels: PublicReportLogThreadLabels): string {
  if (kind === "PUBLIC_COMMENT") return labels.kindPublicComment;
  if (kind === "REPORT_FILED") return labels.kindReportFiled;
  return labels.kindDisposition;
}

function TargetLinks({ row }: { row: PublicReportLogRow }) {
  if (!row.book) {
    return <span className="text-muted">—</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <Link
        href={`/books/${row.book.slug}`}
        className="font-medium text-foreground no-underline hover:underline"
      >
        {row.book.title}
      </Link>
      {row.section ? (
        <>
          <span className="text-muted">·</span>
          <Link
            href={`/books/${row.book.slug}/${row.section.slug}`}
            className="text-accent no-underline hover:underline"
          >
            {row.section.title}
          </Link>
        </>
      ) : null}
    </span>
  );
}

function EntryBlock(props: {
  row: PublicReportLogRow;
  labels: PublicReportLogThreadLabels;
  dispositionLabels: Record<ReportDisposition, string>;
  variant: "root" | "reply";
}) {
  const { row, labels, dispositionLabels, variant } = props;
  const pad = variant === "reply" ? "border-l-2 border-border pl-3 ml-1" : "";

  return (
    <div className={`space-y-1 text-sm ${pad}`}>
      <p className="text-xs text-muted">
        {row.createdAt.toLocaleString()} · {labels.by} {row.actorDisplay} ·{" "}
        {entryKindLabel(row.kind, labels)}
        {row.disposition ? (
          <>
            {" "}
            · {labels.disposition}: {dispositionLabels[row.disposition]}
          </>
        ) : null}
      </p>
      <p className="whitespace-pre-wrap text-foreground">{row.body}</p>
    </div>
  );
}

export function PublicReportLogThreads(props: {
  threads: PublicReportLogThread[];
  dispositionLabels: Record<ReportDisposition, string>;
  labels: PublicReportLogThreadLabels;
  replyCountLabel: (count: number) => string;
}) {
  const { threads, dispositionLabels, labels, replyCountLabel } = props;

  return (
    <ul className="space-y-2">
      {threads.map((thread) => {
        const n = thread.replies.length;
        const replyLabel = n === 0 ? "" : ` · ${replyCountLabel(n)}`;
        const reasonPreview = thread.reporterReason.trim();
        const summaryPreview =
          reasonPreview.length > 0 ? reasonPreview : thread.root.body;

        return (
          <li key={thread.reportId}>
            <details className="group rounded-lg border border-border bg-card">
              <summary
                className="cursor-pointer list-none px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-background/80"
                aria-label={labels.expandThread}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                  <span className="text-xs font-medium text-foreground">
                    {entryKindLabel(thread.root.kind, labels)}
                    {replyLabel}
                  </span>
                  <span className="text-xs text-muted">
                    {thread.root.createdAt.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  <span className="font-medium text-muted">{labels.target}: </span>
                  <TargetLinks row={thread.root} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-foreground">
                  {summaryPreview}
                </p>
              </summary>
              <div className="space-y-4 border-t border-border px-3 py-3">
                {reasonPreview.length > 0 ? (
                  <div className="rounded-md bg-background/80 px-3 py-2">
                    <p className="text-xs font-medium text-muted">
                      {labels.reporterMessage}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {thread.reporterReason}
                    </p>
                  </div>
                ) : null}
                <EntryBlock
                  row={thread.root}
                  labels={labels}
                  dispositionLabels={dispositionLabels}
                  variant="root"
                />
                {n > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted">{labels.followUps}</p>
                    <div className="space-y-3 border-l border-border/80 pl-2">
                      {thread.replies.map((row) => (
                        <EntryBlock
                          key={row.id}
                          row={row}
                          labels={labels}
                          dispositionLabels={dispositionLabels}
                          variant="reply"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
