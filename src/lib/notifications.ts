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
 * Notifies book watchers (excluding actor), digest users who neither watch nor own
 * the book, and the book creator when they are not the actor and not already watching.
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

  const watches = await tx.bookWatch.findMany({
    where: { bookId: input.bookId, userId: { not: input.actorId } },
    select: { userId: true },
  });
  const watcherSet = new Set(watches.map((w) => w.userId));

  const digestNotIn = Array.from(
    new Set([...watcherSet, book.createdById]),
  ).filter((id) => id !== input.actorId);

  const digestWhere: Prisma.UserWhereInput = {
    digestOptIn: true,
    id:
      digestNotIn.length > 0
        ? { not: input.actorId, notIn: digestNotIn }
        : { not: input.actorId },
  };

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

  if (
    book.createdById !== input.actorId &&
    !watcherSet.has(book.createdById)
  ) {
    rows.push({
      id: randomUUID(),
      userId: book.createdById,
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

/** New book: no watchers yet — notify digest subscribers only (excluding actor). */
export async function notifyNewBookDigestTx(
  tx: Prisma.TransactionClient,
  bookId: string,
  actorId: string,
): Promise<string[]> {
  const digestUsers = await tx.user.findMany({
    where: { digestOptIn: true, id: { not: actorId } },
    select: { id: true },
  });
  if (digestUsers.length === 0) return [];

  const data: Prisma.NotificationCreateManyInput[] = digestUsers.map((u) => ({
    id: randomUUID(),
    userId: u.id,
    type: "NEW_BOOK" as const,
    viaDigest: true,
    fromBookOwnership: false,
    bookId,
    sectionId: null,
    revisionId: null,
    reportId: null,
    actorId,
  }));

  await tx.notification.createMany({ data });
  return data.map((d) => d.id as string);
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
