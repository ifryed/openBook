export type BookVisibilityFields = {
  isDraft: boolean;
  createdById: string;
};

export function canViewBook(
  book: BookVisibilityFields,
  session: { user?: { id?: string; isAdmin?: boolean } } | null,
): boolean {
  if (!book.isDraft) return true;
  if (session?.user?.isAdmin) return true;
  const uid = session?.user?.id;
  if (!uid) return false;
  return uid === book.createdById;
}

export function canEditDraftBook(
  book: BookVisibilityFields,
  session: { user?: { id?: string; isAdmin?: boolean } } | null,
): boolean {
  if (!book.isDraft) return true;
  if (session?.user?.isAdmin) return true;
  const uid = session?.user?.id;
  if (!uid) return false;
  return uid === book.createdById;
}
