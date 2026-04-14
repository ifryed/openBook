-- CreateTable
CREATE TABLE "BookLocalization" (
    "book_id" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "BookLocalization_pkey" PRIMARY KEY ("book_id","locale")
);

-- CreateIndex
CREATE INDEX "BookLocalization_locale_idx" ON "BookLocalization"("locale");

-- AddForeignKey
ALTER TABLE "BookLocalization" ADD CONSTRAINT "BookLocalization_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default-locale titles from canonical Book.title
INSERT INTO "BookLocalization" ("book_id", "locale", "title")
SELECT "id", "default_locale", "title" FROM "Book";
