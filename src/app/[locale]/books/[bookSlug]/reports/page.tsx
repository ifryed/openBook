import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { ReportDisposition } from "@prisma/client";
import { PublicReportLogThreads } from "@/components/moderation/public-report-log-threads";
import { prisma } from "@/lib/db";
import { canViewBook } from "@/lib/book-visibility";
import {
  loadPublicModerationLogThreads,
  PUBLIC_REPORT_LOG_PAGE_SIZE,
} from "@/lib/public-report-log";
import { REPORT_DISPOSITION_VALUES } from "@/lib/report-moderation";

type Props = {
  params: Promise<{ locale: string; bookSlug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function BookReportLogPage({ params, searchParams }: Props) {
  const { locale, bookSlug } = await params;
  setRequestLocale(locale);
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const session = await auth();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      isDraft: true,
      createdById: true,
    },
  });
  if (!book) notFound();
  if (
    !canViewBook(
      { isDraft: book.isDraft, createdById: book.createdById },
      session,
    )
  ) {
    notFound();
  }

  const t = await getTranslations("BookReportLog");
  const tLog = await getTranslations("ModerationLog");
  const tDisp = await getTranslations("ReportDispositions");
  const dispositionLabels = Object.fromEntries(
    REPORT_DISPOSITION_VALUES.map((d) => [d, tDisp(d)]),
  ) as Record<ReportDisposition, string>;

  const { totalThreads, threads, page: safePage, totalPages } =
    await loadPublicModerationLogThreads({
      page,
      pageSize: PUBLIC_REPORT_LOG_PAGE_SIZE,
      bookId: book.id,
    });

  const threadLabels = {
    reporterMessage: tLog("reporterMessage"),
    by: tLog("actor"),
    target: tLog("target"),
    disposition: tLog("disposition"),
    kindDisposition: tLog("kindDisposition"),
    kindPublicComment: tLog("kindPublicComment"),
    kindReportFiled: tLog("kindReportFiled"),
    followUps: tLog("threadFollowUps"),
    expandThread: tLog("expandThread"),
  };

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href={`/books/${book.slug}`}
          className="text-accent no-underline hover:underline"
        >
          ← {book.title}
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      {totalThreads === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {tLog("pageStatusThreads", {
              page: safePage,
              totalPages,
              total: totalThreads,
            })}
          </p>
          <PublicReportLogThreads
            threads={threads}
            dispositionLabels={dispositionLabels}
            labels={threadLabels}
            replyCountLabel={(count) => tLog("threadReplyCount", { count })}
          />
          <div className="flex flex-wrap gap-3 text-sm">
            {safePage > 1 ? (
              <Link
                href={
                  safePage === 2
                    ? `/books/${book.slug}/reports`
                    : `/books/${book.slug}/reports?page=${safePage - 1}`
                }
                className="text-accent no-underline hover:underline"
              >
                {tLog("prev")}
              </Link>
            ) : null}
            {safePage < totalPages ? (
              <Link
                href={`/books/${book.slug}/reports?page=${safePage + 1}`}
                className="text-accent no-underline hover:underline"
              >
                {tLog("next")}
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
