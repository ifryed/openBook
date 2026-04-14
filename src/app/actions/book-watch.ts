"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type WatchState = { error?: string; watching?: boolean };

export async function toggleBookWatch(
  bookSlug: string,
): Promise<WatchState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to watch books." };
  }

  const book = await prisma.book.findUnique({ where: { slug: bookSlug } });
  if (!book) return { error: "Book not found." };

  const existing = await prisma.bookWatch.findUnique({
    where: {
      userId_bookId: { userId: session.user.id, bookId: book.id },
    },
  });

  if (existing) {
    await prisma.bookWatch.delete({ where: { id: existing.id } });
    revalidatePath(`/books/${bookSlug}`);
    return { watching: false };
  }

  await prisma.bookWatch.create({
    data: { userId: session.user.id, bookId: book.id },
  });
  revalidatePath(`/books/${bookSlug}`);
  return { watching: true };
}

/** Form action: hidden input `bookSlug`. */
export async function bookWatchFormAction(formData: FormData) {
  const bookSlug = formData.get("bookSlug")?.toString() ?? "";
  await toggleBookWatch(bookSlug);
}
