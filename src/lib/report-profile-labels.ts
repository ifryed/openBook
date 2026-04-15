import type { ReportDisposition } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { REPORT_DISPOSITION_VALUES } from "@/lib/report-moderation";

export type ReportProfileLabels = {
  dispositions: Record<ReportDisposition, string>;
  statusOpen: string;
  statusClosed: string;
  outcomeLabel: string;
  stewardSummaryLabel: string;
};

export async function loadReportProfileLabels(): Promise<ReportProfileLabels> {
  const tDisp = await getTranslations("ReportDispositions");
  const tProf = await getTranslations("ProfileReports");
  const dispositions = Object.fromEntries(
    REPORT_DISPOSITION_VALUES.map((d) => [d, tDisp(d)]),
  ) as Record<ReportDisposition, string>;
  return {
    dispositions,
    statusOpen: tProf("statusOpen"),
    statusClosed: tProf("statusClosed"),
    outcomeLabel: tProf("outcomeLabel"),
    stewardSummaryLabel: tProf("stewardSummaryLabel"),
  };
}
