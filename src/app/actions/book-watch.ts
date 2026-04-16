"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export type WatchState = { error?: string; watching?: boolean };

export async function toggleBookWatch(
  bookSlug: string,
): Promise<WatchState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInToWatch") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: { id: true, isDraft: true, createdById: true },
  });
  if (!book) return { error: t("bookNotFound") };
  if (
    book.isDraft &&
    book.createdById !== session.user.id &&
    !session.user.isAdmin
  ) {
    return { error: t("bookNotFound") };
  }

  const existing = await prisma.bookWatch.findUnique({
    where: {
      userId_bookId: { userId: session.user.id, bookId: book.id },
    },
  });

  if (existing) {
    await prisma.bookWatch.delete({ where: { id: existing.id } });
    revalidatePathLocalized(`/books/${bookSlug}`);
    return { watching: false };
  }

  await prisma.bookWatch.create({
    data: { userId: session.user.id, bookId: book.id },
  });
  revalidatePathLocalized(`/books/${bookSlug}`);
  return { watching: true };
}

/** Form action: hidden input `bookSlug`. */
export async function bookWatchFormAction(formData: FormData) {
  const bookSlug = formData.get("bookSlug")?.toString() ?? "";
  await toggleBookWatch(bookSlug);
}
