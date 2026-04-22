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
 * Notifies book watchers and users who watch the actor (excluding actor),
 * digest users who neither watch the book nor the actor nor own the book,
 * and the book creator when they are not the actor and not already notified as a book watcher.
 */
export async function notifyBookActivityTx(
  tx: Prisma.TransactionClient,
  input: ActivityPayload,
): Promise<string[]> {
  const book = await tx.book.findUnique({
    where: { id: input.bookId },
    select: { createdById: true },
  });
  if (!book) return [];

  const bookWatches = await tx.bookWatch.findMany({
    where: { bookId: input.bookId, userId: { not: input.actorId } },
    select: { userId: true },
  });
  const bookWatcherIds = new Set(bookWatches.map((w) => w.userId));

  const authorWatches = await tx.userWatch.findMany({
    where: { watchedUserId: input.actorId, watcherId: { not: input.actorId } },
    select: { watcherId: true },
  });
  const authorWatcherIds = new Set(authorWatches.map((w) => w.watcherId));

  const immediateRecipients = new Set<string>([
    ...bookWatcherIds,
    ...authorWatcherIds,
  ]);
  immediateRecipients.delete(input.actorId);

  const creatorId = book.createdById;
  const ownerGetsOwnershipRow =
    creatorId !== input.actorId && !bookWatcherIds.has(creatorId);

  if (ownerGetsOwnershipRow) {
    immediateRecipients.delete(creatorId);
  }

  const digestExcludeList = Array.from(
    new Set([...immediateRecipients, creatorId]),
  ).filter((id) => id !== input.actorId);

  const digestWhere: Prisma.UserWhereInput = {
    digestOptIn: true,
    id:
      digestExcludeList.length > 0
        ? { not: input.actorId, notIn: digestExcludeList }
        : { not: input.actorId },
  };

  const digestUsers = await tx.user.findMany({
    where: digestWhere,
    select: { id: true },
  });

  const rows: Prisma.NotificationCreateManyInput[] = [];

  for (const userId of immediateRecipients) {
    rows.push({
      id: randomUUID(),
      userId,
      type: input.type,
      viaDigest: false,
      fromBookOwnership: false,
      bookId: input.bookId,
      sectionId: input.sectionId ?? null,
      revisionId: input.revisionId ?? null,
      reportId: null,
      actorId: input.actorId,
    });
  }

  for (const { id: userId } of digestUsers) {
    rows.push({
      id: randomUUID(),
      userId,
      type: input.type,
      viaDigest: true,
      fromBookOwnership: false,
      bookId: input.bookId,
      sectionId: input.sectionId ?? null,
      revisionId: input.revisionId ?? null,
      reportId: null,
      actorId: input.actorId,
    });
  }

  if (ownerGetsOwnershipRow) {
    rows.push({
      id: randomUUID(),
      userId: creatorId,
      type: input.type,
      viaDigest: false,
      fromBookOwnership: true,
      bookId: input.bookId,
      sectionId: input.sectionId ?? null,
      revisionId: input.revisionId ?? null,
      reportId: null,
      actorId: input.actorId,
    });
  }

  if (rows.length === 0) return [];
  await tx.notification.createMany({ data: rows });
  return rows.map((r) => r.id as string);
}

/**
 * New book: notify users who watch the author (immediate), then digest subscribers
 * who do not watch that author (excluding the actor).
 */
export async function notifyNewBookDigestTx(
  tx: Prisma.TransactionClient,
  bookId: string,
  actorId: string,
): Promise<string[]> {
  const authorWatches = await tx.userWatch.findMany({
    where: { watchedUserId: actorId, watcherId: { not: actorId } },
    select: { watcherId: true },
  });
  const authorWatcherIds = Array.from(
    new Set(authorWatches.map((w) => w.watcherId)),
  );

  const digestWhere: Prisma.UserWhereInput = {
    digestOptIn: true,
    id:
      authorWatcherIds.length > 0
        ? { not: actorId, notIn: authorWatcherIds }
        : { not: actorId },
  };

  const digestUsers = await tx.user.findMany({
    where: digestWhere,
    select: { id: true },
  });

  const rows: Prisma.NotificationCreateManyInput[] = [];

  for (const userId of authorWatcherIds) {
    rows.push({
      id: randomUUID(),
      userId,
      type: "NEW_BOOK" as const,
      viaDigest: false,
      fromBookOwnership: false,
      bookId,
      sectionId: null,
      revisionId: null,
      reportId: null,
      actorId,
    });
  }

  for (const { id: userId } of digestUsers) {
    rows.push({
      id: randomUUID(),
      userId,
      type: "NEW_BOOK" as const,
      viaDigest: true,
      fromBookOwnership: false,
      bookId,
      sectionId: null,
      revisionId: null,
      reportId: null,
      actorId,
    });
  }

  if (rows.length === 0) return [];
  await tx.notification.createMany({ data: rows });
  return rows.map((r) => r.id as string);
}

export type ReportNotificationKind =
  | "REPORT_PUBLIC_COMMENT"
  | "REPORT_RESOLVED";

export async function notifyReportActivityTx(
  tx: Prisma.TransactionClient,
  input: {
    reportId: string;
    bookId: string | null;
    sectionId: string | null;
    actorId: string;
    type: ReportNotificationKind;
  },
): Promise<string[]> {
  const report = await tx.report.findUnique({
    where: { id: input.reportId },
    select: { userId: true },
  });
  if (!report || report.userId === input.actorId) return [];

  const id = randomUUID();
  await tx.notification.create({
    data: {
      id,
      userId: report.userId,
      type: input.type,
      viaDigest: false,
      fromBookOwnership: false,
      bookId: input.bookId,
      sectionId: input.sectionId,
      revisionId: null,
      reportId: input.reportId,
      actorId: input.actorId,
    },
  });
  return [id];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
