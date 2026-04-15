-- CreateEnum
CREATE TYPE "ReportDisposition" AS ENUM ('CONTENT_ADDRESSED', 'NO_ACTION_NEEDED', 'INVALID_OR_ABUSIVE');

-- CreateEnum
CREATE TYPE "ReportModerationLogKind" AS ENUM ('DISPOSITION_SET', 'PUBLIC_COMMENT', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "ReportModerationLogVisibility" AS ENUM ('PUBLIC', 'STEWARD_ONLY');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "disposition" "ReportDisposition";

-- CreateTable
CREATE TABLE "report_moderation_log_entries" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "ReportModerationLogKind" NOT NULL,
    "visibility" "ReportModerationLogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "disposition" "ReportDisposition",
    "body" TEXT NOT NULL,

    CONSTRAINT "report_moderation_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_moderation_log_entries_report_id_created_at_idx" ON "report_moderation_log_entries"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "report_moderation_log_entries_created_at_idx" ON "report_moderation_log_entries"("created_at");

-- AddForeignKey
ALTER TABLE "report_moderation_log_entries" ADD CONSTRAINT "report_moderation_log_entries_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_moderation_log_entries" ADD CONSTRAINT "report_moderation_log_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill closed reports: default disposition and a public log line for transparency history
UPDATE "Report"
SET "disposition" = 'NO_ACTION_NEEDED'
WHERE "status" = 'RESOLVED' AND "disposition" IS NULL;

INSERT INTO "report_moderation_log_entries" ("id", "report_id", "actor_id", "created_at", "kind", "visibility", "disposition", "body")
SELECT
  gen_random_uuid()::text,
  r."id",
  COALESCE(r."resolved_by_id", r."user_id"),
  COALESCE(r."resolved_at", r."created_at"),
  'DISPOSITION_SET',
  'PUBLIC',
  'NO_ACTION_NEEDED',
  'Migrated from earlier system.'
FROM "Report" r
WHERE r."status" = 'RESOLVED';
