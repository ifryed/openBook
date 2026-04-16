-- CreateEnum
CREATE TYPE "ContentDraftKind" AS ENUM ('BOOK', 'CHAPTER');

-- CreateTable
CREATE TABLE "content_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "ContentDraftKind" NOT NULL,
    "label" VARCHAR(512) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_drafts_user_id_updated_at_idx" ON "content_drafts"("user_id", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
