import type { EmailNotifyMode, NotificationType } from "@prisma/client";

/** Subset of User needed to decide whether to send an activity email. */
export type EmailNotificationPrefs = {
  emailNotifyMode: EmailNotifyMode;
  emailFromWatch: boolean;
  emailFromDigest: boolean;
  emailFromOwnedBooks: boolean;
  emailReportUpdates: boolean;
  emailTypeNewRevision: boolean;
  emailTypeNewBook: boolean;
  emailTypeNewSection: boolean;
  emailTypeRevert: boolean;
  emailTypeReportPublicComment: boolean;
  emailTypeReportResolved: boolean;
};

export function typeEnabledForEmail(
  prefs: EmailNotificationPrefs,
  type: NotificationType,
): boolean {
  switch (type) {
    case "NEW_REVISION":
      return prefs.emailTypeNewRevision;
    case "NEW_BOOK":
      return prefs.emailTypeNewBook;
    case "NEW_SECTION":
      return prefs.emailTypeNewSection;
    case "REVERT":
      return prefs.emailTypeRevert;
    case "REPORT_PUBLIC_COMMENT":
      return prefs.emailTypeReportPublicComment;
    case "REPORT_RESOLVED":
      return prefs.emailTypeReportResolved;
    default:
      return false;
  }
}

export function shouldEmailNotificationForPrefs(
  prefs: EmailNotificationPrefs,
  input: {
    type: NotificationType;
    viaDigest: boolean;
    fromBookOwnership: boolean;
    reportId: string | null;
  },
): boolean {
  if (prefs.emailNotifyMode === "OFF") return false;
  if (prefs.emailNotifyMode === "ALL") return true;

  if (!typeEnabledForEmail(prefs, input.type)) return false;

  if (input.reportId) {
    return prefs.emailReportUpdates;
  }
  if (input.fromBookOwnership) {
    return prefs.emailFromOwnedBooks;
  }
  if (input.viaDigest) {
    return prefs.emailFromDigest;
  }
  return prefs.emailFromWatch;
}
