-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_REVISION', 'NEW_BOOK', 'NEW_SECTION', 'REVERT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReputationKind" AS ENUM ('REVISION_SAVED', 'BOOK_CREATED', 'SECTION_ADDED', 'REVERT', 'REPORT_RESOLVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "reputation_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "digest_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "status" "ReportStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Report" ADD COLUMN "resolved_at" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "resolved_by_id" TEXT;

-- CreateTable
CREATE TABLE "BookWatch" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "via_digest" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "book_id" TEXT,
    "section_id" TEXT,
    "revision_id" TEXT,
    "actor_id" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "ReputationKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "ref_book_id" TEXT,
    "ref_section_id" TEXT,
    "ref_revision_id" TEXT,
    "ref_report_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookWatch_user_id_book_id_key" ON "BookWatch"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "BookWatch_book_id_idx" ON "BookWatch"("book_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_at_created_at_idx" ON "Notification"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "ReputationEvent_user_id_created_at_idx" ON "ReputationEvent"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ReputationEvent_user_id_kind_created_at_idx" ON "ReputationEvent"("user_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "BookWatch" ADD CONSTRAINT "BookWatch_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookWatch" ADD CONSTRAINT "BookWatch_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
