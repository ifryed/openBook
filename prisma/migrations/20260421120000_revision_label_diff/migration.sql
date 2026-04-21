-- Snapshot text for chapter/book name edits (shown as a second diff on history).
ALTER TABLE "Revision" ADD COLUMN "label_diff_before" TEXT;
ALTER TABLE "Revision" ADD COLUMN "label_diff_after" TEXT;
