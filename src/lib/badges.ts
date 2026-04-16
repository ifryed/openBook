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

/** Emoji + card chrome for profile UI (Tailwind classes must stay literal strings). */
export type BadgeVisual = {
  emoji: string;
  cardClass: string;
};

export const BADGE_VISUAL: Record<BadgeId, BadgeVisual> = {
  first_book: {
    emoji: "📚",
    cardClass:
      "border-amber-400/45 bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-transparent shadow-sm shadow-amber-500/15",
  },
  bibliographer: {
    emoji: "📖",
    cardClass:
      "border-orange-500/40 bg-gradient-to-br from-orange-500/18 to-rose-500/10 shadow-sm shadow-orange-500/10",
  },
  architect: {
    emoji: "🏗️",
    cardClass:
      "border-sky-400/45 bg-gradient-to-br from-sky-400/18 to-cyan-500/10 shadow-sm shadow-sky-500/15",
  },
  first_edit: {
    emoji: "✏️",
    cardClass:
      "border-blue-400/45 bg-gradient-to-br from-blue-400/15 to-indigo-500/10 shadow-sm shadow-blue-500/10",
  },
  scribe: {
    emoji: "📝",
    cardClass:
      "border-teal-400/45 bg-gradient-to-br from-teal-400/18 to-emerald-600/10 shadow-sm shadow-teal-500/12",
  },
  historian: {
    emoji: "📜",
    cardClass:
      "border-violet-500/40 bg-gradient-to-br from-violet-500/18 to-purple-600/10 shadow-sm shadow-violet-500/15",
  },
  curator: {
    emoji: "🔁",
    cardClass:
      "border-rose-400/45 bg-gradient-to-br from-rose-400/16 to-fuchsia-500/10 shadow-sm shadow-rose-500/12",
  },
  contributor_tier: {
    emoji: "⭐",
    cardClass:
      "border-yellow-500/40 bg-gradient-to-br from-yellow-400/22 to-amber-500/12 shadow-sm shadow-amber-400/20",
  },
  steward_tier: {
    emoji: "👑",
    cardClass:
      "border-purple-500/45 bg-gradient-to-br from-purple-500/22 via-fuchsia-500/12 to-violet-600/15 shadow-md shadow-purple-500/20",
  },
  moderator: {
    emoji: "🛡️",
    cardClass:
      "border-emerald-500/40 bg-gradient-to-br from-emerald-500/18 to-green-600/10 shadow-sm shadow-emerald-500/12",
  },
  trusted_resolver: {
    emoji: "🤝",
    cardClass:
      "border-cyan-500/40 bg-gradient-to-br from-cyan-400/16 to-teal-600/12 shadow-sm shadow-cyan-500/15",
  },
};

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
    prisma.book.count({
      where: { createdById: userId, isDraft: false },
    }),
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
