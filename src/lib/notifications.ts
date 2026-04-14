import { randomUUID } from "crypto";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type ActivityPayload = {
  bookId: string;
  actorId: string;
  type: NotificationType;
  sectionId?: string | null;
  revisionId?: string | null;
};

/**
 * Notifies book watchers (excluding actor) and digest users who do not watch this book.
 */
export async function notifyBookActivityTx(
  tx: Prisma.TransactionClient,
  input: ActivityPayload,
) {
  const watches = await tx.bookWatch.findMany({
    where: { bookId: input.bookId, userId: { not: input.actorId } },
    select: { userId: true },
  });
  const watcherSet = new Set(watches.map((w) => w.userId));

  const digestWhere: Prisma.UserWhereInput = {
    digestOptIn: true,
    id: { not: input.actorId },
  };
  if (watcherSet.size > 0) {
    digestWhere.id = { not: input.actorId, notIn: [...watcherSet] };
  }

  const digestUsers = await tx.user.findMany({
    where: digestWhere,
    select: { id: true },
  });

  const rows: Prisma.NotificationCreateManyInput[] = [];

  for (const userId of watcherSet) {
    rows.push({
      id: randomUUID(),
      userId,
      type: input.type,
      viaDigest: false,
      bookId: input.bookId,
      sectionId: input.sectionId ?? null,
      revisionId: input.revisionId ?? null,
      actorId: input.actorId,
    });
  }

  for (const { id: userId } of digestUsers) {
    rows.push({
      id: randomUUID(),
      userId,
      type: input.type,
      viaDigest: true,
      bookId: input.bookId,
      sectionId: input.sectionId ?? null,
      revisionId: input.revisionId ?? null,
      actorId: input.actorId,
    });
  }

  if (rows.length > 0) {
    await tx.notification.createMany({ data: rows });
  }
}

/** New book: no watchers yet — notify digest subscribers only (excluding actor). */
export async function notifyNewBookDigestTx(
  tx: Prisma.TransactionClient,
  bookId: string,
  actorId: string,
) {
  const digestUsers = await tx.user.findMany({
    where: { digestOptIn: true, id: { not: actorId } },
    select: { id: true },
  });
  if (digestUsers.length === 0) return;

  await tx.notification.createMany({
    data: digestUsers.map((u) => ({
      id: randomUUID(),
      userId: u.id,
      type: "NEW_BOOK" as const,
      viaDigest: true,
      bookId,
      sectionId: null,
      revisionId: null,
      actorId,
    })),
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
