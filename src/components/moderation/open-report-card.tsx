import type {
  ReportDisposition,
  ReportModerationLogKind,
  ReportModerationLogVisibility,
} from "@prisma/client";
import { Link } from "@/i18n/navigation";
import {
  addPublicReportComment,
  closeReportWithDisposition,
} from "@/app/actions/moderation";
import {
  REPORT_DISPOSITION_VALUES,
  REPORT_INTERNAL_NOTE_MAX,
  REPORT_PUBLIC_COMMENT_MAX,
  REPORT_PUBLIC_COMMENT_MIN,
  REPORT_PUBLIC_SUMMARY_MAX,
  REPORT_PUBLIC_SUMMARY_MIN,
} from "@/lib/report-moderation";
import { resolveSectionTitle } from "@/lib/section-localization";

type Actor = { name: string | null; email: string | null };

export type OpenReportCardLogEntry = {
  id: string;
  createdAt: Date;
  kind: ReportModerationLogKind;
  visibility: ReportModerationLogVisibility;
  disposition: ReportDisposition | null;
  body: string;
  actor: Actor;
};

export type OpenReportCardReport = {
  id: string;
  createdAt: Date;
  reason: string;
  user: Actor;
  book: {
    slug: string;
    title: string;
  } | null;
  section: {
    slug: string;
    localizations: { locale: string; title: string }[];
    book: { defaultLocale: string };
  } | null;
  moderationLog: OpenReportCardLogEntry[];
};

function actorLabel(a: Actor): string {
  const n = a.name?.trim();
  return n && n.length > 0 ? n : a.email ?? "—";
}

type Labels = {
  reportedBy: string;
  reporterMessage: string;
  timeline: string;
  kindDisposition: string;
  kindPublicComment: string;
  kindReportFiled: string;
  kindInternal: string;
  closeHeading: string;
  dispositionLabel: string;
  publicSummary: string;
  publicSummaryHint: string;
  internalNote: string;
  internalNoteHint: string;
  closeSubmit: string;
  commentHeading: string;
  commentHint: string;
  commentSubmit: string;
};

type DispositionLabels = Record<ReportDisposition, string>;

export function OpenReportModerationCard({
  report: r,
  labels,
  dispositionLabels,
}: {
  report: OpenReportCardReport;
  labels: Labels;
  dispositionLabels: DispositionLabels;
}) {
  const sectionTitle =
    r.section && r.book
      ? resolveSectionTitle(
          r.section.slug,
          r.section.localizations,
          r.section.book.defaultLocale,
          r.section.book.defaultLocale,
        )
      : null;

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs text-muted">
        {r.createdAt.toLocaleString()} · {labels.reportedBy}{" "}
        {actorLabel(r.user)}
      </p>
      {r.book ? (
        <p className="mt-2">
          <span className="text-muted">Book: </span>
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
                {sectionTitle}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="mt-3 rounded-md bg-background/80 px-3 py-2">
        <p className="text-xs font-medium text-muted">{labels.reporterMessage}</p>
        <blockquote className="mt-1 border-l-2 border-border pl-3 text-foreground">
          {r.reason}
        </blockquote>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted">{labels.timeline}</p>
        <ul className="mt-2 space-y-2 border-l border-border pl-3">
          {r.moderationLog.length === 0 ? (
            <li className="text-xs text-muted">—</li>
          ) : (
            r.moderationLog.map((e) => (
              <li key={e.id} className="text-xs">
                <span className="text-muted">
                  {e.createdAt.toLocaleString()} · {actorLabel(e.actor)} ·{" "}
                </span>
                {e.visibility === "STEWARD_ONLY" ? (
                  <span className="text-amber-800 dark:text-amber-200">
                    {labels.kindInternal}
                  </span>
                ) : e.kind === "PUBLIC_COMMENT" ? (
                  <span>{labels.kindPublicComment}</span>
                ) : e.kind === "REPORT_FILED" ? (
                  <span>{labels.kindReportFiled}</span>
                ) : (
                  <span>{labels.kindDisposition}</span>
                )}
                {e.disposition ? (
                  <span className="text-muted">
                    {" "}
                    ({dispositionLabels[e.disposition]})
                  </span>
                ) : null}
                <blockquote className="mt-1 border-l-2 border-border pl-2 text-foreground">
                  {e.body}
                </blockquote>
              </li>
            ))
          )}
        </ul>
      </div>

      <form action={addPublicReportComment} className="mt-4 space-y-2 border-t border-border pt-4">
        <input type="hidden" name="reportId" value={r.id} />
        <p className="text-xs font-medium text-foreground">{labels.commentHeading}</p>
        <p className="text-xs text-muted">{labels.commentHint}</p>
        <textarea
          name="comment"
          rows={2}
          minLength={REPORT_PUBLIC_COMMENT_MIN}
          maxLength={REPORT_PUBLIC_COMMENT_MAX}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          placeholder={`${REPORT_PUBLIC_COMMENT_MIN}–${REPORT_PUBLIC_COMMENT_MAX} characters`}
        />
        <button
          type="submit"
          className="cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-card"
        >
          {labels.commentSubmit}
        </button>
      </form>

      <form action={closeReportWithDisposition} className="mt-4 space-y-3 border-t border-border pt-4">
        <input type="hidden" name="reportId" value={r.id} />
        <p className="text-xs font-medium text-foreground">{labels.closeHeading}</p>
        <fieldset>
          <legend className="mb-2 text-xs text-muted">{labels.dispositionLabel}</legend>
          <div className="flex flex-col gap-2">
            {REPORT_DISPOSITION_VALUES.map((d) => (
              <label key={d} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="radio" name="disposition" value={d} required className="mt-1" />
                <span>{dispositionLabels[d]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-xs font-medium">{labels.publicSummary}</span>
          <p className="text-xs text-muted">{labels.publicSummaryHint}</p>
          <textarea
            name="publicSummary"
            required
            rows={3}
            minLength={REPORT_PUBLIC_SUMMARY_MIN}
            maxLength={REPORT_PUBLIC_SUMMARY_MAX}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder={`${REPORT_PUBLIC_SUMMARY_MIN}–${REPORT_PUBLIC_SUMMARY_MAX} characters`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium">{labels.internalNote}</span>
          <p className="text-xs text-muted">{labels.internalNoteHint}</p>
          <textarea
            name="internalNote"
            rows={2}
            maxLength={REPORT_INTERNAL_NOTE_MAX}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm !text-white hover:opacity-90"
        >
          {labels.closeSubmit}
        </button>
      </form>
    </li>
  );
}
