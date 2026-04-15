"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";

export type ReportState = { error?: string; ok?: boolean };

export async function submitReport(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInToReport") };
  }

  const bookSlug = formData.get("bookSlug")?.toString();
  const sectionSlug = formData.get("sectionSlug")?.toString() || null;
  const reason = formData.get("reason")?.toString().trim() ?? "";

  if (reason.length < 10) {
    return { error: t("reportTooShort") };
  }

  const book = await prisma.book.findUnique({ where: { slug: bookSlug ?? "" } });
  if (!book) return { error: t("bookNotFound") };

  let sectionId: string | null = null;
  if (sectionSlug) {
    const section = await prisma.section.findFirst({
      where: { bookId: book.id, slug: sectionSlug },
    });
    sectionId = section?.id ?? null;
  }

  const userId = session.user.id;
  const locale = await getLocale();
  const tLog = await getTranslations({ locale, namespace: "ModerationLog" });
  const filedBody = sectionId
    ? tLog("reportFiledSection")
    : tLog("reportFiledBook");

  await prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        bookId: book.id,
        sectionId,
        userId,
        reason,
      },
      select: { id: true },
    });
    await tx.reportModerationLogEntry.create({
      data: {
        reportId: report.id,
        actorId: userId,
        kind: "REPORT_FILED",
        visibility: "PUBLIC",
        body: filedBody,
      },
    });
  });

  revalidatePathLocalized(`/books/${book.slug}`);
  revalidatePathLocalized(`/books/${book.slug}/reports`);
  if (sectionSlug) {
    revalidatePathLocalized(`/books/${book.slug}/${sectionSlug}`);
  }
  revalidatePathLocalized("/moderation/reports");
  revalidatePathLocalized("/moderation/log");

  return { ok: true };
}
