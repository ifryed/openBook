import { prisma } from "@/lib/db";
import { tierFromPoints } from "@/lib/reputation";

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

function limitsForUserPoints(points: number) {
  const tier = tierFromPoints(points);
  switch (tier) {
    case "STEWARD":
      return { booksPerHour: 40, revisionsPerHour: 480 };
    case "CONTRIBUTOR":
      return { booksPerHour: 20, revisionsPerHour: 240 };
    default:
      return { booksPerHour: 10, revisionsPerHour: 120 };
  }
}

async function userPoints(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationPoints: true },
  });
  return u?.reputationPoints ?? 0;
}

export async function assertCanCreateBook(userId: string) {
  const points = await userPoints(userId);
  const { booksPerHour } = limitsForUserPoints(points);
  const n = await prisma.book.count({
    where: {
      createdById: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n >= booksPerHour) {
    throw new Error(
      `You can create at most ${booksPerHour} books per hour. Try again later.`,
    );
  }
}

export async function assertCanCreateRevision(userId: string) {
  const points = await userPoints(userId);
  const { revisionsPerHour } = limitsForUserPoints(points);
  const n = await prisma.revision.count({
    where: {
      authorId: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n >= revisionsPerHour) {
    throw new Error(
      `Edit rate limit reached (${revisionsPerHour} revisions per hour). Try again later.`,
    );
  }
}

/** Ensures creating `howMany` new revisions in one batch stays under the hourly cap. */
export async function assertRevisionBudget(userId: string, howMany: number) {
  if (howMany <= 0) return;
  const points = await userPoints(userId);
  const { revisionsPerHour } = limitsForUserPoints(points);
  const n = await prisma.revision.count({
    where: {
      authorId: userId,
      createdAt: { gte: hourAgo() },
    },
  });
  if (n + howMany > revisionsPerHour) {
    throw new Error(
      `Adding ${howMany} sections would exceed ${revisionsPerHour} revisions per hour (you have ${n} in the last hour). Try fewer sections or wait.`,
    );
  }
}
