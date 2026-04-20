import { prisma } from "@/lib/db";
import {
  shouldEmailNotificationForPrefs,
  type EmailNotificationPrefs,
} from "@/lib/email-notification-eligibility";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  notificationHref,
  notificationSummary,
} from "@/lib/notification-copy";
import { getPublicOrigin } from "@/lib/public-origin";
import { resolveSectionTitle } from "@/lib/section-localization";

const userEmailPrefsSelect = {
  email: true,
  emailNotifyMode: true,
  emailFromWatch: true,
  emailFromDigest: true,
  emailFromOwnedBooks: true,
  emailReportUpdates: true,
  emailTypeNewRevision: true,
  emailTypeNewBook: true,
  emailTypeNewSection: true,
  emailTypeRevert: true,
  emailTypeReportPublicComment: true,
  emailTypeReportResolved: true,
} as const;

let warnedMissingResendConfig = false;

function warnMissingResendConfigOnce() {
  if (warnedMissingResendConfig) return;
  warnedMissingResendConfig = true;
  console.warn(
    "[notification-email] Set RESEND_API_KEY and RESEND_FROM_EMAIL to send activity mail.",
  );
}

/**
 * Loads notifications and sends email. Must be awaited from server actions so
 * sends complete before the runtime freezes work (e.g. before redirect).
 */
export async function dispatchNotificationEmails(
  notificationIds: string[],
): Promise<void> {
  const unique = [...new Set(notificationIds)].filter(Boolean);
  if (unique.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    warnMissingResendConfigOnce();
    return;
  }

  const rows = await prisma.notification.findMany({
    where: { id: { in: unique } },
    include: {
      user: { select: userEmailPrefsSelect },
      book: {
        select: {
          slug: true,
          title: true,
          defaultLocale: true,
        },
      },
      section: {
        select: {
          slug: true,
          localizations: { select: { locale: true, title: true } },
          book: { select: { defaultLocale: true } },
        },
      },
    },
  });

  const origin = getPublicOrigin();
  const settingsUrl = `${origin}/en/settings`;

  for (const n of rows) {
    const prefs = n.user as EmailNotificationPrefs;
    if (
      !shouldEmailNotificationForPrefs(prefs, {
        type: n.type,
        viaDigest: n.viaDigest,
        fromBookOwnership: n.fromBookOwnership,
        reportId: n.reportId,
      })
    ) {
      continue;
    }

    const book = n.book;
    if (!book) continue;

    const sectionTitle = n.section
      ? resolveSectionTitle(
          n.section.slug,
          n.section.localizations,
          book.defaultLocale,
          n.section.book.defaultLocale,
        )
      : undefined;

    const summary = notificationSummary({
      type: n.type,
      bookTitle: book.title,
      sectionTitle,
    });

    const path = notificationHref({
      bookSlug: book.slug,
      sectionSlug: n.section?.slug ?? null,
      type: n.type,
    });
    const openUrl = `${origin}/en${path}`;

    const subject = `OpenBook: ${summary}`;
    const text = `${summary}\n\nOpen: ${openUrl}\n\nChange email preferences: ${settingsUrl}`;
    const html = `<p>${escapeHtml(summary)}</p><p><a href="${escapeAttr(openUrl)}">View in OpenBook</a></p><p style="font-size:12px;color:#666">You receive this because activity notifications are enabled on your account. <a href="${escapeAttr(settingsUrl)}">Email settings</a></p>`;

    const result = await sendTransactionalEmail({
      to: n.user.email,
      subject,
      text,
      html,
    });
    if (!result.ok) {
      console.warn("[notification-email] send failed:", result.error);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
