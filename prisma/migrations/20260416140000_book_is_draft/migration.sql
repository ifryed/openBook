-- AlterTable
ALTER TABLE "Book" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Book_created_by_id_is_draft_idx" ON "Book"("created_by_id", "is_draft");
