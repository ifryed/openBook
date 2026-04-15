-- New enum value must be committed before use in a follow-up migration (Postgres).
ALTER TYPE "ReportModerationLogKind" ADD VALUE 'REPORT_FILED';
