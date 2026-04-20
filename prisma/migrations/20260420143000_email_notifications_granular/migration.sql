-- CreateEnum
CREATE TYPE "EmailNotifyMode" AS ENUM ('OFF', 'ALL', 'CUSTOM');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_PUBLIC_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_RESOLVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "email_notify_mode" "EmailNotifyMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN "email_from_watch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_from_digest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_from_owned_books" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_report_updates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_new_revision" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_new_book" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_new_section" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_revert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_report_public_comment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_type_report_resolved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "from_book_ownership" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "report_id" TEXT;

-- CreateIndex
CREATE INDEX "Notification_report_id_idx" ON "Notification"("report_id");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
