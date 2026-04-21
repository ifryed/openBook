-- AlterTable
ALTER TABLE "User" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);

-- Grandfather existing accounts (User has no created_at column; deploy-time acceptance).
UPDATE "User" SET "terms_accepted_at" = CURRENT_TIMESTAMP WHERE "terms_accepted_at" IS NULL;
