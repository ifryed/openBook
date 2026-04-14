import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getLatestRevision(sectionId: string, db: Db = prisma) {
  return db.revision.findFirst({
    where: { sectionId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function listRevisions(sectionId: string) {
  return prisma.revision.findMany({
    where: { sectionId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function createRevision(
  input: {
    sectionId: string;
    authorId: string;
    body: string;
    summaryComment?: string | null;
    parentRevisionId?: string | null;
  },
  db: Db = prisma,
) {
  return db.revision.create({
    data: {
      sectionId: input.sectionId,
      authorId: input.authorId,
      body: input.body,
      summaryComment: input.summaryComment ?? null,
      parentRevisionId: input.parentRevisionId ?? null,
    },
  });
}

export async function revertToRevision(
  input: {
    sectionId: string;
    authorId: string;
    targetRevisionId: string;
    summaryComment?: string | null;
  },
  db: Db = prisma,
) {
  const target = await db.revision.findFirst({
    where: { id: input.targetRevisionId, sectionId: input.sectionId },
  });
  if (!target) throw new Error("Revision not found");

  const latest = await getLatestRevision(input.sectionId, db);
  if (latest?.id === target.id) {
    throw new Error("Already at this revision");
  }

  return createRevision(
    {
      sectionId: input.sectionId,
      authorId: input.authorId,
      body: target.body,
      summaryComment:
        input.summaryComment ??
        `Revert to revision from ${target.createdAt.toISOString()}`,
      parentRevisionId: latest?.id ?? null,
    },
    db,
  );
}
