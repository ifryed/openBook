import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { ReportDisposition } from "@prisma/client";
import { PublicReportLogThreads } from "@/components/moderation/public-report-log-threads";
import {
  loadPublicModerationLogThreads,
  PUBLIC_REPORT_LOG_PAGE_SIZE,
} from "@/lib/public-report-log";
import { REPORT_DISPOSITION_VALUES } from "@/lib/report-moderation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function PublicModerationLogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);

  const t = await getTranslations("ModerationLog");
  const tDisp = await getTranslations("ReportDispositions");
  const dispositionLabels = Object.fromEntries(
    REPORT_DISPOSITION_VALUES.map((d) => [d, tDisp(d)]),
  ) as Record<ReportDisposition, string>;

  const { totalThreads, threads, page: safePage, totalPages } =
    await loadPublicModerationLogThreads({
      page,
      pageSize: PUBLIC_REPORT_LOG_PAGE_SIZE,
    });

  const threadLabels = {
    reporterMessage: t("reporterMessage"),
    by: t("actor"),
    target: t("target"),
    disposition: t("disposition"),
    kindDisposition: t("kindDisposition"),
    kindPublicComment: t("kindPublicComment"),
    kindReportFiled: t("kindReportFiled"),
    followUps: t("threadFollowUps"),
    expandThread: t("expandThread"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      {totalThreads === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {t("pageStatusThreads", {
              page: safePage,
              totalPages,
              total: totalThreads,
            })}
          </p>
          <PublicReportLogThreads
            threads={threads}
            dispositionLabels={dispositionLabels}
            labels={threadLabels}
            replyCountLabel={(count) => t("threadReplyCount", { count })}
          />

          <div className="flex flex-wrap gap-3 text-sm">
            {safePage > 1 ? (
              <Link
                href={safePage === 2 ? "/moderation/log" : `/moderation/log?page=${safePage - 1}`}
                className="text-accent no-underline hover:underline"
              >
                {t("prev")}
              </Link>
            ) : null}
            {safePage < totalPages ? (
              <Link
                href={`/moderation/log?page=${safePage + 1}`}
                className="text-accent no-underline hover:underline"
              >
                {t("next")}
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
