import type { ReportDisposition, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveSectionTitle } from "@/lib/section-localization";
import {
  getUserPointsAndTier,
  type TrustTier,
} from "@/lib/reputation";
import {
  toReputationEventDisplayRows,
  type ReputationEventDisplayRow,
} from "@/lib/reputation-event-display";
import { computeUserEarnedBadgeIds, type BadgeId } from "@/lib/badges";

export const PROFILE_LIST_LIMIT = 50;
export const PROFILE_REPORTS_LIMIT = 25;
export const PROFILE_PREVIEW_LIMIT = 3;

/** Public profile: never use email; fall back when name is empty. */
export function publicProfileDisplayName(
  name: string | null | undefined,
): string {
  const t = name?.trim();
  return t && t.length > 0 ? t : "Contributor";
}

export type ProfileBookRow = {
  id: string;
  slug: string;
  title: string;
  updatedAt: Date;
  isDraft: boolean;
};

export type ProfileRevisionRow = {
  id: string;
  createdAt: Date;
  summaryComment: string | null;
  section: {
    slug: string;
    title: string;
    book: { slug: string; title: string };
  };
};

export type ProfileCoreData = {
  profile: { points: number; tier: TrustTier };
  books: ProfileBookRow[];
  revisions: ProfileRevisionRow[];
  contributionRows: ReputationEventDisplayRow[];
  reputationEventAtLimit: boolean;
  earnedBadgeIds: BadgeId[];
};

export async function loadProfileBooks(
  userId: string,
  limit: number,
  viewerUserId?: string | null,
): Promise<ProfileBookRow[]> {
  const ownerView = viewerUserId != null && viewerUserId === userId;
  return prisma.book.findMany({
    where: {
      createdById: userId,
      ...(ownerView ? {} : { isDraft: false }),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      updatedAt: true,
      isDraft: true,
    },
  });
}

export async function loadProfileRevisions(
  userId: string,
  limit: number,
): Promise<ProfileRevisionRow[]> {
  const rows = await prisma.revision.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      summaryComment: true,
      locale: true,
      section: {
        select: {
          slug: true,
          localizations: { select: { locale: true, title: true } },
          book: { select: { slug: true, title: true, defaultLocale: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    summaryComment: r.summaryComment,
    section: {
      slug: r.section.slug,
      title: resolveSectionTitle(
        r.section.slug,
        r.section.localizations,
        r.locale,
        r.section.book.defaultLocale,
      ),
      book: {
        slug: r.section.book.slug,
        title: r.section.book.title,
      },
    },
  }));
}

export async function loadProfileContributionRows(
  userId: string,
  limit: number,
): Promise<{
  rows: ReputationEventDisplayRow[];
  reputationEventAtLimit: boolean;
}> {
  const reputationEvents = await prisma.reputationEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const bookIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const e of reputationEvents) {
    if (e.refBookId) bookIds.add(e.refBookId);
    if (e.refSectionId) sectionIds.add(e.refSectionId);
  }

  const [refBooks, refSections] = await Promise.all([
    bookIds.size
      ? prisma.book.findMany({
          where: { id: { in: [...bookIds] } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    sectionIds.size
      ? prisma.section.findMany({
          where: { id: { in: [...sectionIds] } },
          select: {
            id: true,
            slug: true,
            book: { select: { slug: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const bookById = new Map(refBooks.map((b) => [b.id, { slug: b.slug }]));
  const sectionById = new Map(
    refSections.map((s) => [s.id, { slug: s.slug, book: s.book }]),
  );

  const rows = toReputationEventDisplayRows(
    reputationEvents,
    bookById,
    sectionById,
  );

  return {
    rows,
    reputationEventAtLimit: reputationEvents.length >= limit,
  };
}

export async function loadUserProfileCore(
  userId: string,
  listLimit: number = PROFILE_LIST_LIMIT,
  viewerUserId?: string | null,
): Promise<ProfileCoreData> {
  const [profile, books, revisions, contrib, earnedBadgeIds] = await Promise.all([
    getUserPointsAndTier(userId),
    loadProfileBooks(userId, listLimit, viewerUserId),
    loadProfileRevisions(userId, listLimit),
    loadProfileContributionRows(userId, listLimit),
    computeUserEarnedBadgeIds(userId),
  ]);

  return {
    profile,
    books,
    revisions,
    contributionRows: contrib.rows,
    reputationEventAtLimit: contrib.reputationEventAtLimit,
    earnedBadgeIds,
  };
}

export type ProfileWatchRow = {
  id: string;
  createdAt: Date;
  book: { slug: string; title: string; updatedAt: Date };
};

export type ProfileUserWatchRow = {
  id: string;
  createdAt: Date;
  watchedUser: { id: string; name: string | null; email: string };
};

export type ProfileFiledReportRow = {
  id: string;
  createdAt: Date;
  status: ReportStatus;
  disposition: ReportDisposition | null;
  /** Steward-written public close summary, when the report was closed. */
  closePublicSummary: string | null;
  reason: string;
  book: { slug: string; title: string } | null;
  section: { slug: string; title: string } | null;
};

export type ProfilePrivateExtras = {
  watches: ProfileWatchRow[];
  userWatches: ProfileUserWatchRow[];
  filedReports: ProfileFiledReportRow[];
};

export async function loadProfileWatches(
  userId: string,
  limit: number,
): Promise<ProfileWatchRow[]> {
  const watches = await prisma.bookWatch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      book: { select: { slug: true, title: true, updatedAt: true } },
    },
  });
  return watches.map((w) => ({
    id: w.id,
    createdAt: w.createdAt,
    book: w.book,
  }));
}

export async function loadProfileUserWatches(
  userId: string,
  limit: number,
): Promise<ProfileUserWatchRow[]> {
  const rows = await prisma.userWatch.findMany({
    where: { watcherId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      watchedUser: { select: { id: true, name: true, email: true } },
    },
  });
  return rows.map((w) => ({
    id: w.id,
    createdAt: w.createdAt,
    watchedUser: w.watchedUser,
  }));
}

export async function loadProfileFiledReports(
  userId: string,
  limit: number,
): Promise<ProfileFiledReportRow[]> {
  const filedReports = await prisma.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      book: { select: { slug: true, title: true } },
      section: {
        select: {
          slug: true,
          localizations: { select: { locale: true, title: true } },
          book: { select: { defaultLocale: true } },
        },
      },
      moderationLog: {
        where: { kind: "DISPOSITION_SET", visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true },
      },
    },
  });
  return filedReports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    status: r.status,
    disposition: r.disposition,
    closePublicSummary: r.moderationLog[0]?.body ?? null,
    reason: r.reason,
    book: r.book,
    section: r.section
      ? {
          slug: r.section.slug,
          title: resolveSectionTitle(
            r.section.slug,
            r.section.localizations,
            r.section.book.defaultLocale,
            r.section.book.defaultLocale,
          ),
        }
      : null,
  }));
}

export async function loadUserProfilePrivate(
  userId: string,
  listLimit: number = PROFILE_LIST_LIMIT,
  reportsLimit: number = PROFILE_REPORTS_LIMIT,
): Promise<ProfilePrivateExtras> {
  const [watches, userWatches, filedReports] = await Promise.all([
    loadProfileWatches(userId, listLimit),
    loadProfileUserWatches(userId, listLimit),
    loadProfileFiledReports(userId, reportsLimit),
  ]);
  return { watches, userWatches, filedReports };
}

export type ProfileSectionCounts = {
  books: number;
  revisions: number;
  contributions: number;
  watches: number;
  userWatches: number;
  reports: number;
};

export async function getProfileSectionCounts(
  userId: string,
  viewerUserId?: string | null,
): Promise<ProfileSectionCounts> {
  const ownerView = viewerUserId != null && viewerUserId === userId;
  const [books, revisions, contributions, watches, userWatches, reports] =
    await Promise.all([
      prisma.book.count({
        where: {
          createdById: userId,
          ...(ownerView ? {} : { isDraft: false }),
        },
      }),
      prisma.revision.count({ where: { authorId: userId } }),
      prisma.reputationEvent.count({ where: { userId } }),
      prisma.bookWatch.count({ where: { userId } }),
      prisma.userWatch.count({ where: { watcherId: userId } }),
      prisma.report.count({ where: { userId } }),
    ]);
  return {
    books,
    revisions,
    contributions,
    watches,
    userWatches,
    reports,
  };
}
