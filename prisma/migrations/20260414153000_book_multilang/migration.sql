-- AlterTable
ALTER TABLE "Book" ADD COLUMN "default_locale" VARCHAR(16) NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "BookLanguage" (
    "book_id" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,

    CONSTRAINT "BookLanguage_pkey" PRIMARY KEY ("book_id","locale")
);

-- CreateTable
CREATE TABLE "SectionLocalization" (
    "section_id" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" VARCHAR(255) NOT NULL,

    CONSTRAINT "SectionLocalization_pkey" PRIMARY KEY ("section_id","locale")
);

-- AlterTable
ALTER TABLE "Revision" ADD COLUMN "locale" VARCHAR(16) NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE INDEX "Revision_section_id_locale_created_at_idx" ON "Revision"("section_id", "locale", "created_at");

-- CreateIndex
CREATE INDEX "BookLanguage_locale_idx" ON "BookLanguage"("locale");

-- CreateIndex
CREATE INDEX "SectionLocalization_locale_idx" ON "SectionLocalization"("locale");

-- AddForeignKey
ALTER TABLE "BookLanguage" ADD CONSTRAINT "BookLanguage_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionLocalization" ADD CONSTRAINT "SectionLocalization_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: one language row per book
INSERT INTO "BookLanguage" ("book_id", "locale")
SELECT "id", "default_locale" FROM "Book";

-- Data: section titles -> localizations using each book's default locale
INSERT INTO "SectionLocalization" ("section_id", "locale", "title")
SELECT s."id", b."default_locale", LEFT(s."title", 255)
FROM "Section" s
INNER JOIN "Book" b ON b."id" = s."book_id";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "title";
