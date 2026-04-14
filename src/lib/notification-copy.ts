import type { NotificationType } from "@prisma/client";

export function notificationSummary(input: {
  type: NotificationType;
  bookTitle: string;
  sectionTitle?: string | null;
}): string {
  const { type, bookTitle, sectionTitle } = input;
  switch (type) {
    case "NEW_BOOK":
      return `New book: ${bookTitle}`;
    case "NEW_SECTION":
      return sectionTitle
        ? `New section “${sectionTitle}” in ${bookTitle}`
        : `New sections in ${bookTitle}`;
    case "NEW_REVISION":
      return sectionTitle
        ? `New edit in “${sectionTitle}” · ${bookTitle}`
        : `New edit in ${bookTitle}`;
    case "REVERT":
      return sectionTitle
        ? `Revision reverted in “${sectionTitle}” · ${bookTitle}`
        : `Revision reverted in ${bookTitle}`;
    default:
      return `Update · ${bookTitle}`;
  }
}

export function notificationHref(input: {
  bookSlug: string;
  sectionSlug?: string | null;
  type: NotificationType;
}): string {
  const { bookSlug, sectionSlug, type } = input;
  if (type === "NEW_BOOK") {
    return `/books/${bookSlug}`;
  }
  if (sectionSlug) {
    return `/books/${bookSlug}/${sectionSlug}/history`;
  }
  return `/books/${bookSlug}`;
}
