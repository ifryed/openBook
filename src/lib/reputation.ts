import { randomUUID } from "crypto";
import type { Prisma, ReputationKind } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TrustTier = "NEWCOMER" | "CONTRIBUTOR" | "STEWARD";

const KIND_DELTAS: Record<ReputationKind, number> = {
  REVISION_SAVED: 2,
  BOOK_CREATED: 25,
  SECTION_ADDED: 5,
  REVERT: 3,
  REPORT_RESOLVED: 8,
};

/** Max points from this kind per UTC day (sum of deltas for events that counted). */
const KIND_DAILY_POINT_CAPS: Record<ReputationKind, number> = {
  REVISION_SAVED: 60,
  BOOK_CREATED: 75,
  SECTION_ADDED: 40,
  REVERT: 30,
  REPORT_RESOLVED: 40,
};

export function tierFromPoints(points: number): TrustTier {
  if (points >= 500) return "STEWARD";
  if (points >= 100) return "CONTRIBUTOR";
  return "NEWCOMER";
}

export function tierLabel(tier: TrustTier): string {
  switch (tier) {
    case "STEWARD":
      return "Steward";
    case "CONTRIBUTOR":
      return "Contributor";
    default:
      return "Newcomer";
  }
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export async function getUserPointsAndTier(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationPoints: true },
  });
  const points = user?.reputationPoints ?? 0;
  return { points, tier: tierFromPoints(points) };
}

type AwardRefs = {
  refBookId?: string | null;
  refSectionId?: string | null;
  refRevisionId?: string | null;
  refReportId?: string | null;
};

/**
 * Records reputation if under the daily point cap for this kind. Returns points actually added.
 */
export async function awardReputationTx(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: ReputationKind,
  refs: AwardRefs = {},
): Promise<number> {
  const delta = KIND_DELTAS[kind];
  const cap = KIND_DAILY_POINT_CAPS[kind];
  const since = startOfUtcDay();

  const agg = await tx.reputationEvent.aggregate({
    where: { userId, kind, createdAt: { gte: since } },
    _sum: { delta: true },
  });
  const used = agg._sum.delta ?? 0;
  if (used >= cap) return 0;
  const room = cap - used;
  const apply = Math.min(delta, room);
  if (apply <= 0) return 0;

  await tx.reputationEvent.create({
    data: {
      id: randomUUID(),
      userId,
      kind,
      delta: apply,
      refBookId: refs.refBookId ?? null,
      refSectionId: refs.refSectionId ?? null,
      refRevisionId: refs.refRevisionId ?? null,
      refReportId: refs.refReportId ?? null,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: { reputationPoints: { increment: apply } },
  });

  return apply;
}
