import { prisma } from "@/lib/db";

export const BADGE_IDS = [
  "first_book",
  "bibliographer",
  "architect",
  "first_edit",
  "scribe",
  "historian",
  "curator",
  "contributor_tier",
  "steward_tier",
  "moderator",
  "trusted_resolver",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type BadgeCategory = "create" | "edit" | "community" | "trust";

export type BadgeDefinition = {
  id: BadgeId;
  /** Display order within profile (lower first). */
  sortOrder: number;
  category: BadgeCategory;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: "first_book", sortOrder: 10, category: "create" },
  { id: "bibliographer", sortOrder: 20, category: "create" },
  { id: "architect", sortOrder: 30, category: "create" },
  { id: "first_edit", sortOrder: 40, category: "edit" },
  { id: "scribe", sortOrder: 50, category: "edit" },
  { id: "historian", sortOrder: 60, category: "edit" },
  { id: "curator", sortOrder: 70, category: "edit" },
  { id: "contributor_tier", sortOrder: 80, category: "trust" },
  { id: "steward_tier", sortOrder: 90, category: "trust" },
  { id: "moderator", sortOrder: 100, category: "community" },
  { id: "trusted_resolver", sortOrder: 110, category: "community" },
];

const BADGE_BY_ID: Map<BadgeId, BadgeDefinition> = new Map(
  BADGE_DEFINITIONS.map((d) => [d.id, d]),
);

type Counts = {
  booksCreated: number;
  revisions: number;
  reportsResolved: number;
  reverts: number;
  sectionAddEvents: number;
  points: number;
};

function isEarned(id: BadgeId, c: Counts): boolean {
  switch (id) {
    case "first_book":
      return c.booksCreated >= 1;
    case "bibliographer":
      return c.booksCreated >= 5;
    case "first_edit":
      return c.revisions >= 1;
    case "scribe":
      return c.revisions >= 25;
    case "historian":
      return c.revisions >= 100;
    case "contributor_tier":
      return c.points >= 100;
    case "steward_tier":
      return c.points >= 500;
    case "moderator":
      return c.reportsResolved >= 1;
    case "trusted_resolver":
      return c.reportsResolved >= 10;
    case "curator":
      return c.reverts >= 5;
    case "architect":
      return c.sectionAddEvents >= 1;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Earned badges sorted for profile (definition order). */
export function sortEarnedBadgeIds(ids: BadgeId[]): BadgeId[] {
  return [...ids].sort(
    (a, b) =>
      (BADGE_BY_ID.get(a)?.sortOrder ?? 0) - (BADGE_BY_ID.get(b)?.sortOrder ?? 0),
  );
}

export type UserBadgeState = {
  earned: BadgeId[];
  byId: Record<BadgeId, boolean>;
};

/** Loads counts once; returns sorted earned ids and a lookup of all badge ids. */
export async function computeUserBadgeState(
  userId: string,
): Promise<UserBadgeState> {
  const [
    booksCreated,
    revisions,
    reportsResolved,
    reverts,
    sectionAddEvents,
    user,
  ] = await Promise.all([
    prisma.book.count({ where: { createdById: userId } }),
    prisma.revision.count({ where: { authorId: userId } }),
    prisma.report.count({
      where: { resolvedById: userId, status: "RESOLVED" },
    }),
    prisma.reputationEvent.count({
      where: { userId, kind: "REVERT" },
    }),
    prisma.reputationEvent.count({
      where: { userId, kind: "SECTION_ADDED" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { reputationPoints: true },
    }),
  ]);

  const points = user?.reputationPoints ?? 0;
  const counts: Counts = {
    booksCreated,
    revisions,
    reportsResolved,
    reverts,
    sectionAddEvents,
    points,
  };

  const byId = {} as Record<BadgeId, boolean>;
  const earned: BadgeId[] = [];
  for (const id of BADGE_IDS) {
    const ok = isEarned(id, counts);
    byId[id] = ok;
    if (ok) earned.push(id);
  }
  return { earned: sortEarnedBadgeIds(earned), byId };
}

export async function computeUserEarnedBadgeIds(
  userId: string,
): Promise<BadgeId[]> {
  const { earned } = await computeUserBadgeState(userId);
  return earned;
}
