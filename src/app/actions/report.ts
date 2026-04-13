"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type ReportState = { error?: string; ok?: boolean };

export async function submitReport(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to report content." };
  }

  const bookSlug = formData.get("bookSlug")?.toString();
  const sectionSlug = formData.get("sectionSlug")?.toString() || null;
  const reason = formData.get("reason")?.toString().trim() ?? "";

  if (reason.length < 10) {
    return { error: "Please describe the issue (at least 10 characters)." };
  }

  const book = await prisma.book.findUnique({ where: { slug: bookSlug ?? "" } });
  if (!book) return { error: "Book not found." };

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

  revalidatePath(`/books/${book.slug}`);
  if (sectionSlug) {
    revalidatePath(`/books/${book.slug}/${sectionSlug}`);
  }

  return { ok: true };
}
