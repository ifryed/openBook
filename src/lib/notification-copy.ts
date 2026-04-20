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
    case "REPORT_PUBLIC_COMMENT":
      return `New public comment on your report · ${bookTitle}`;
    case "REPORT_RESOLVED":
      return `Report resolved · ${bookTitle}`;
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
  if (type === "REPORT_PUBLIC_COMMENT" || type === "REPORT_RESOLVED") {
    return `/books/${bookSlug}/reports`;
  }
  if (sectionSlug) {
    return `/books/${bookSlug}/${sectionSlug}/history`;
  }
  return `/books/${bookSlug}`;
}
