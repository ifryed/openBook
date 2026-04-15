import type { ReportDisposition } from "@prisma/client";

export const REPORT_PUBLIC_SUMMARY_MIN = 10;
export const REPORT_PUBLIC_SUMMARY_MAX = 500;
export const REPORT_INTERNAL_NOTE_MAX = 2000;
export const REPORT_PUBLIC_COMMENT_MIN = 5;
export const REPORT_PUBLIC_COMMENT_MAX = 2000;

export const REPORT_DISPOSITION_VALUES: ReportDisposition[] = [
  "CONTENT_ADDRESSED",
  "NO_ACTION_NEEDED",
  "INVALID_OR_ABUSIVE",
];

export function parseReportDisposition(
  raw: string | null | undefined,
): ReportDisposition | null {
  if (!raw) return null;
  return REPORT_DISPOSITION_VALUES.includes(raw as ReportDisposition)
    ? (raw as ReportDisposition)
    : null;
}
