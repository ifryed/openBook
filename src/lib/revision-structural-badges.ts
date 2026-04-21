/**
 * Derives UI flags from `Revision.labelDiffBefore` / `labelDiffAfter` populated by
 * structural edits in `appendStructuralEditRevisionTx` (see `books.ts`).
 */
export function revisionStructuralBadgeFlags(
  labelDiffBefore: string | null | undefined,
  labelDiffAfter: string | null | undefined,
): { bookTitleEdit: boolean; chapterTitleEdit: boolean } {
  const chunks = [labelDiffBefore, labelDiffAfter].filter(
    (s): s is string => s != null && s.length > 0,
  );
  if (chunks.length === 0) {
    return { bookTitleEdit: false, chapterTitleEdit: false };
  }

  const bookTitleLocalized = /^\s*Book title\s*\(/;
  const bookTitleFromSettings = /^\s*Title:\s/;
  const chapterTitleLocalized = /^\s*Chapter title\s*\(/;

  let bookTitleEdit = false;
  let chapterTitleEdit = false;
  for (const line of chunks.join("\n").split("\n")) {
    if (bookTitleLocalized.test(line) || bookTitleFromSettings.test(line)) {
      bookTitleEdit = true;
    }
    if (chapterTitleLocalized.test(line)) {
      chapterTitleEdit = true;
    }
  }
  return { bookTitleEdit, chapterTitleEdit };
}
