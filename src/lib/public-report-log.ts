import type { ReportDisposition } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveSectionTitle } from "@/lib/section-localization";

export const PUBLIC_REPORT_LOG_PAGE_SIZE = 20;

export type PublicReportLogRow = {
  id: string;
  createdAt: Date;
  kind: string;
  disposition: ReportDisposition | null;
  body: string;
  actorDisplay: string;
  book: { slug: string; title: string } | null;
  section: {
    slug: string;
    title: string;
  } | null;
};

export type PublicReportLogThread = {
  reportId: string;
  /** Original text submitted with the report (shown on the public log). */
  reporterReason: string;
  /** Earliest public entry (normally REPORT_FILED). */
  root: PublicReportLogRow;
  /** Later public entries on the same report, chronological. */
  replies: PublicReportLogRow[];
};

function mapEntry(e: {
  id: string;
  createdAt: Date;
  kind: string;
  disposition: ReportDisposition | null;
  body: string;
  actor: { name: string | null; email: string | null };
  report: {
    reason: string;
    book: { slug: string; title: string } | null;
    section: {
      slug: string;
      localizations: { locale: string; title: string }[];
      book: { defaultLocale: string };
    } | null;
  };
}): PublicReportLogRow {
  const sec = e.report.section;
  const book = e.report.book;
  const section =
    sec && book
      ? {
          slug: sec.slug,
          title: resolveSectionTitle(
            sec.slug,
            sec.localizations,
            sec.book.defaultLocale,
            sec.book.defaultLocale,
          ),
        }
      : null;

  const name = e.actor.name?.trim();
  const actorDisplay =
    name && name.length > 0 ? name : e.actor.email ?? "—";

  return {
    id: e.id,
    createdAt: e.createdAt,
    kind: e.kind,
    disposition: e.disposition,
    body: e.body,
    actorDisplay,
    book: book ? { slug: book.slug, title: book.title } : null,
    section,
  };
}

function splitThread(
  reportId: string,
  rows: PublicReportLogRow[],
  reporterReason: string,
): PublicReportLogThread {
  const sorted = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const filedIdx = sorted.findIndex((r) => r.kind === "REPORT_FILED");
  const rootIdx = filedIdx >= 0 ? filedIdx : 0;
  const root = sorted[rootIdx]!;
  const replies = sorted.filter((_, i) => i !== rootIdx);
  return { reportId, reporterReason, root, replies };
}

/**
 * Paginates by **report** (thread): each item is one report with root filing + nested public follow-ups.
 */
export async function loadPublicModerationLogThreads(opts: {
  page: number;
  pageSize?: number;
  bookId?: string;
}): Promise<{
  totalThreads: number;
  threads: PublicReportLogThread[];
  page: number;
  totalPages: number;
}> {
  const pageSize = opts.pageSize ?? PUBLIC_REPORT_LOG_PAGE_SIZE;
  const rawPage = Number.isFinite(opts.page) && opts.page >= 1 ? opts.page : 1;

  const bookFilter =
    opts.bookId != null
      ? Prisma.sql`AND r.book_id = ${opts.bookId}`
      : Prisma.empty;

  const countRows = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT COUNT(*)::bigint AS n
    FROM (
      SELECT e.report_id
      FROM report_moderation_log_entries e
      INNER JOIN "Report" r ON r.id = e.report_id
      WHERE e.visibility = 'PUBLIC'
      ${bookFilter}
      GROUP BY e.report_id
    ) sub
  `;
  const totalThreads = Number(countRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalThreads / pageSize));
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * pageSize;

  if (totalThreads === 0) {
    return { totalThreads: 0, threads: [], page: 1, totalPages: 1 };
  }

  const idRows = await prisma.$queryRaw<{ report_id: string }[]>`
    SELECT e.report_id
    FROM report_moderation_log_entries e
    INNER JOIN "Report" r ON r.id = e.report_id
    WHERE e.visibility = 'PUBLIC'
    ${bookFilter}
    GROUP BY e.report_id
    ORDER BY MAX(e.created_at) DESC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `;

  const reportIds = idRows.map((r) => r.report_id);
  if (reportIds.length === 0) {
    return { totalThreads, threads: [], page, totalPages };
  }

  const raw = await prisma.reportModerationLogEntry.findMany({
    where: {
      visibility: "PUBLIC",
      reportId: { in: reportIds },
    },
    orderBy: [{ reportId: "asc" }, { createdAt: "asc" }],
    include: {
      actor: { select: { name: true, email: true } },
      report: {
        select: {
          reason: true,
          book: { select: { slug: true, title: true } },
          section: {
            select: {
              slug: true,
              localizations: { select: { locale: true, title: true } },
              book: { select: { defaultLocale: true } },
            },
          },
        },
      },
    },
  });

  const reasonByReport = new Map<string, string>();
  const byReport = new Map<string, PublicReportLogRow[]>();
  for (const e of raw) {
    if (!reasonByReport.has(e.reportId)) {
      reasonByReport.set(e.reportId, e.report.reason);
    }
    const row = mapEntry(e);
    const list = byReport.get(e.reportId) ?? [];
    list.push(row);
    byReport.set(e.reportId, list);
  }

  const threads: PublicReportLogThread[] = reportIds.map((id) =>
    splitThread(id, byReport.get(id) ?? [], reasonByReport.get(id) ?? ""),
  );

  return { totalThreads, threads, page, totalPages };
}
