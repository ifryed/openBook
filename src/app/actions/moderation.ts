"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canResolveReports } from "@/lib/moderation";
import { awardReputationTx } from "@/lib/reputation";
import {
  parseReportDisposition,
  REPORT_INTERNAL_NOTE_MAX,
  REPORT_PUBLIC_COMMENT_MAX,
  REPORT_PUBLIC_COMMENT_MIN,
  REPORT_PUBLIC_SUMMARY_MAX,
  REPORT_PUBLIC_SUMMARY_MIN,
} from "@/lib/report-moderation";
import { getTranslations } from "next-intl/server";
import { dispatchNotificationEmails } from "@/lib/notification-email-dispatch";
import { notifyReportActivityTx } from "@/lib/notifications";

function revalidateReportPaths(bookSlug: string | null | undefined) {
  revalidatePathLocalized("/moderation/reports");
  revalidatePathLocalized("/moderation/log");
  if (bookSlug) {
    revalidatePathLocalized(`/books/${bookSlug}`);
    revalidatePathLocalized(`/books/${bookSlug}/reports`);
  }
}

export async function closeReportWithDisposition(formData: FormData) {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("signInRequired"));
  }

  const allowed = await canResolveReports(session.user.id, {
    isAdmin: session.user.isAdmin,
  });
  if (!allowed) {
    throw new Error(t("onlyStewardResolve"));
  }

  const reportId = formData.get("reportId")?.toString() ?? "";
  if (!reportId) throw new Error(t("missingReport"));

  const disposition = parseReportDisposition(
    formData.get("disposition")?.toString(),
  );
  if (!disposition) throw new Error(t("reportDispositionInvalid"));

  const publicSummary =
    formData.get("publicSummary")?.toString().trim() ?? "";
  if (publicSummary.length < REPORT_PUBLIC_SUMMARY_MIN) {
    throw new Error(t("reportPublicSummaryTooShort"));
  }
  if (publicSummary.length > REPORT_PUBLIC_SUMMARY_MAX) {
    throw new Error(t("reportPublicSummaryTooLong"));
  }

  const internalNoteRaw = formData.get("internalNote")?.toString().trim() ?? "";
  if (internalNoteRaw.length > REPORT_INTERNAL_NOTE_MAX) {
    throw new Error(t("reportInternalNoteTooLong"));
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      bookId: true,
      sectionId: true,
      book: { select: { slug: true } },
    },
  });
  if (!report) throw new Error(t("reportNotFound"));
  if (report.status !== "OPEN") {
    throw new Error(t("reportAlreadyResolved"));
  }

  const now = new Date();
  const actorId = session.user.id;

  const emailIds = await prisma.$transaction(async (tx) => {
    await tx.reportModerationLogEntry.create({
      data: {
        reportId,
        actorId,
        kind: "DISPOSITION_SET",
        visibility: "PUBLIC",
        disposition,
        body: publicSummary,
      },
    });
    if (internalNoteRaw.length > 0) {
      await tx.reportModerationLogEntry.create({
        data: {
          reportId,
          actorId,
          kind: "INTERNAL_NOTE",
          visibility: "STEWARD_ONLY",
          disposition: null,
          body: internalNoteRaw,
        },
      });
    }
    await tx.report.update({
      where: { id: reportId },
      data: {
        status: "RESOLVED",
        disposition,
        resolvedAt: now,
        resolvedById: actorId,
      },
    });
    await awardReputationTx(tx, actorId, "REPORT_RESOLVED", {
      refReportId: reportId,
      refBookId: report.bookId,
      refSectionId: report.sectionId,
    });
    return await notifyReportActivityTx(tx, {
      reportId,
      bookId: report.bookId,
      sectionId: report.sectionId,
      actorId,
      type: "REPORT_RESOLVED",
    });
  });
  await dispatchNotificationEmails(emailIds);

  revalidateReportPaths(report.book?.slug);
}

export async function addPublicReportComment(formData: FormData) {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("signInRequired"));
  }

  const allowed = await canResolveReports(session.user.id, {
    isAdmin: session.user.isAdmin,
  });
  if (!allowed) {
    throw new Error(t("onlyStewardResolve"));
  }

  const reportId = formData.get("reportId")?.toString() ?? "";
  if (!reportId) throw new Error(t("missingReport"));

  const body = formData.get("comment")?.toString().trim() ?? "";
  if (body.length < REPORT_PUBLIC_COMMENT_MIN) {
    throw new Error(t("reportPublicCommentTooShort"));
  }
  if (body.length > REPORT_PUBLIC_COMMENT_MAX) {
    throw new Error(t("reportPublicCommentTooLong"));
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      bookId: true,
      sectionId: true,
      book: { select: { slug: true } },
    },
  });
  if (!report) throw new Error(t("reportNotFound"));
  if (report.status !== "OPEN") {
    throw new Error(t("reportPublicCommentOnlyOpen"));
  }

  const emailIds = await prisma.$transaction(async (tx) => {
    await tx.reportModerationLogEntry.create({
      data: {
        reportId,
        actorId: session.user.id,
        kind: "PUBLIC_COMMENT",
        visibility: "PUBLIC",
        disposition: null,
        body,
      },
    });
    return await notifyReportActivityTx(tx, {
      reportId,
      bookId: report.bookId,
      sectionId: report.sectionId,
      actorId: session.user.id,
      type: "REPORT_PUBLIC_COMMENT",
    });
  });
  await dispatchNotificationEmails(emailIds);

  revalidateReportPaths(report.book?.slug);
}
