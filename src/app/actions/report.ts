"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

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

  await prisma.report.create({
    data: {
      bookId: book.id,
      sectionId,
      userId: session.user.id,
      reason,
    },
  });

  revalidatePathLocalized(`/books/${book.slug}`);
  if (sectionSlug) {
    revalidatePathLocalized(`/books/${book.slug}/${sectionSlug}`);
  }

  return { ok: true };
}
