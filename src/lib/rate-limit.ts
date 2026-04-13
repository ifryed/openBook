import { prisma } from "@/lib/db";

const BOOKS_PER_HOUR = 10;
const REVISIONS_PER_HOUR = 120;

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

export async function assertCanCreateBook(userId: string) {
  const n = await prisma.book.count({
    where: {
      createdById: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n >= BOOKS_PER_HOUR) {
    throw new Error(
      `You can create at most ${BOOKS_PER_HOUR} books per hour. Try again later.`,
    );
  }
}

export async function assertCanCreateRevision(userId: string) {
  const n = await prisma.revision.count({
    where: {
      authorId: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n >= REVISIONS_PER_HOUR) {
    throw new Error(
      `Edit rate limit reached (${REVISIONS_PER_HOUR} revisions per hour). Try again later.`,
    );
  }
}

/** Ensures creating `howMany` new revisions in one batch stays under the hourly cap. */
export async function assertRevisionBudget(userId: string, howMany: number) {
  if (howMany <= 0) return;
  const n = await prisma.revision.count({
    where: {
      authorId: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n + howMany > REVISIONS_PER_HOUR) {
    throw new Error(
      `Adding ${howMany} sections would exceed ${REVISIONS_PER_HOUR} revisions per hour (you have ${n} in the last hour). Try fewer sections or wait.`,
    );
  }
}
