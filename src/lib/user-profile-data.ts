import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getUserPointsAndTier,
  type TrustTier,
} from "@/lib/reputation";
import {
  toReputationEventDisplayRows,
  type ReputationEventDisplayRow,
} from "@/lib/reputation-event-display";

export const PROFILE_LIST_LIMIT = 50;
export const PROFILE_REPORTS_LIMIT = 25;

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
};

export async function loadUserProfileCore(
  userId: string,
): Promise<ProfileCoreData> {
  const [profile, books, revisions, reputationEvents] = await Promise.all([
    getUserPointsAndTier(userId),
    prisma.book.findMany({
      where: { createdById: userId },
      orderBy: { updatedAt: "desc" },
      take: PROFILE_LIST_LIMIT,
      select: { id: true, slug: true, title: true, updatedAt: true },
    }),
    prisma.revision.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: PROFILE_LIST_LIMIT,
      select: {
        id: true,
        createdAt: true,
        summaryComment: true,
        section: {
          select: {
            slug: true,
            title: true,
            book: { select: { slug: true, title: true } },
          },
        },
      },
    }),
    prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PROFILE_LIST_LIMIT,
    }),
  ]);

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

  const contributionRows = toReputationEventDisplayRows(
    reputationEvents,
    bookById,
    sectionById,
  );

  return {
    profile,
    books,
    revisions,
    contributionRows,
    reputationEventAtLimit: reputationEvents.length >= PROFILE_LIST_LIMIT,
  };
}

export type ProfileWatchRow = {
  id: string;
  createdAt: Date;
  book: { slug: string; title: string; updatedAt: Date };
};

export type ProfileFiledReportRow = {
  id: string;
  createdAt: Date;
  status: ReportStatus;
  reason: string;
  book: { slug: string; title: string } | null;
  section: { slug: string; title: string } | null;
};

export type ProfilePrivateExtras = {
  watches: ProfileWatchRow[];
  filedReports: ProfileFiledReportRow[];
};

export async function loadUserProfilePrivate(
  userId: string,
): Promise<ProfilePrivateExtras> {
  const [watches, filedReports] = await Promise.all([
    prisma.bookWatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PROFILE_LIST_LIMIT,
      include: {
        book: { select: { slug: true, title: true, updatedAt: true } },
      },
    }),
    prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PROFILE_REPORTS_LIMIT,
      include: {
        book: { select: { slug: true, title: true } },
        section: { select: { slug: true, title: true } },
      },
    }),
  ]);

  return {
    watches: watches.map((w) => ({
      id: w.id,
      createdAt: w.createdAt,
      book: w.book,
    })),
    filedReports: filedReports.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      reason: r.reason,
      book: r.book,
      section: r.section,
    })),
  };
}
