import type { ReportDisposition } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { resolveSectionTitle } from "@/lib/section-localization";

type Actor = { name: string | null; email: string | null };

export type ClosedReportRowData = {
  id: string;
  resolvedAt: Date | null;
  disposition: ReportDisposition | null;
  publicCloseSummary: string | null;
  resolvedBy: Actor | null;
  book: { slug: string; title: string } | null;
  section: {
    slug: string;
    localizations: { locale: string; title: string }[];
    book: { defaultLocale: string };
  } | null;
};

function actorLabel(a: Actor | null): string {
  if (!a) return "—";
  const n = a.name?.trim();
  return n && n.length > 0 ? n : a.email ?? "—";
}

export function ClosedReportRow({
  report: r,
  labels,
  dispositionLabels,
}: {
  report: ClosedReportRowData;
  labels: {
    closedAt: string;
    closedBy: string;
    outcome: string;
    summary: string;
    legacyNoDisposition: string;
  };
  dispositionLabels: Record<ReportDisposition, string>;
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

  const dispositionLabel =
    r.disposition != null
      ? dispositionLabels[r.disposition]
      : labels.legacyNoDisposition;

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs text-muted">
        {r.resolvedAt
          ? `${labels.closedAt} ${r.resolvedAt.toLocaleString()}`
          : "—"}{" "}
        · {labels.closedBy} {actorLabel(r.resolvedBy)}
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
      <p className="mt-2 text-xs text-muted">
        {labels.outcome}:{" "}
        <span className="font-medium text-foreground">{dispositionLabel}</span>
      </p>
      {r.publicCloseSummary ? (
        <blockquote className="mt-2 border-l-2 border-border pl-3 text-foreground">
          <span className="text-xs text-muted">{labels.summary}: </span>
          {r.publicCloseSummary}
        </blockquote>
      ) : null}
    </li>
  );
}
