import type { ReputationEvent, ReputationKind } from "@prisma/client";

export function labelForReputationKind(kind: ReputationKind): string {
  switch (kind) {
    case "REVISION_SAVED":
      return "Saved a revision";
    case "BOOK_CREATED":
      return "Created a book";
    case "SECTION_ADDED":
      return "Added a section";
    case "REVERT":
      return "Reverted a section";
    case "REPORT_RESOLVED":
      return "Resolved a report";
    default:
      return "Contribution";
  }
}

type BookSlugRef = { slug: string };
type SectionSlugRef = { slug: string; book: { slug: string } };

export function hrefForReputationEvent(
  event: Pick<
    ReputationEvent,
    "kind" | "refBookId" | "refSectionId"
  >,
  bookById: Map<string, BookSlugRef>,
  sectionById: Map<string, SectionSlugRef>,
): string | null {
  const { kind, refBookId, refSectionId } = event;
  if (refSectionId) {
    const sec = sectionById.get(refSectionId);
    if (sec) {
      if (kind === "REVERT") {
        return `/books/${sec.book.slug}/${sec.slug}/history`;
      }
      return `/books/${sec.book.slug}/${sec.slug}`;
    }
  }
  if (refBookId) {
    const book = bookById.get(refBookId);
    if (book) return `/books/${book.slug}`;
  }
  return null;
}

export type ReputationEventDisplayRow = {
  id: string;
  createdAt: Date;
  delta: number;
  kind: ReputationKind;
  label: string;
  href: string | null;
};

export function toReputationEventDisplayRows(
  events: ReputationEvent[],
  bookById: Map<string, BookSlugRef>,
  sectionById: Map<string, SectionSlugRef>,
): ReputationEventDisplayRow[] {
  return events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    delta: e.delta,
    kind: e.kind,
    label: labelForReputationKind(e.kind),
    href: hrefForReputationEvent(e, bookById, sectionById),
  }));
}
