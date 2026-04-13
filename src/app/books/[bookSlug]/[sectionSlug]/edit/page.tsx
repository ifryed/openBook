import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBookContextMarkdown } from "@/lib/book-context";
import { prisma } from "@/lib/db";
import { getLatestRevision } from "@/lib/revisions";
import { EditSectionForm } from "./edit-section-form";

type Props = {
  params: Promise<{ bookSlug: string; sectionSlug: string }>;
};

export default async function SectionEditPage({ params }: Props) {
  const { bookSlug, sectionSlug } = await params;

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: { select: { slug: true, title: true } },
    },
  });

  if (!section) notFound();

  const sectionCount = await prisma.section.count({
    where: { bookId: section.bookId },
  });

  const [bookMeta, allSections] = await Promise.all([
    prisma.book.findUnique({
      where: { id: section.bookId },
      select: { title: true, figureName: true, intendedAges: true },
    }),
    prisma.section.findMany({
      where: { bookId: section.bookId },
      orderBy: { orderIndex: "asc" },
      include: {
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true },
        },
      },
    }),
  ]);

  const bookContextMarkdown = buildBookContextMarkdown(
    allSections.map((s) => ({
      slug: s.slug,
      title: s.title,
      body: s.revisions[0]?.body ?? "",
    })),
    section.slug,
  );

  const latest = await getLatestRevision(section.id);
  const initialBody = latest?.body ?? "";

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link
          href={`/books/${section.book.slug}/${section.slug}`}
          className="text-accent no-underline hover:underline"
        >
          ← {section.title}
        </Link>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold">Edit: {section.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Markdown supported. Each save creates a new revision; nothing is
          overwritten.
        </p>
      </div>
      <EditSectionForm
        bookSlug={section.book.slug}
        sectionSlug={section.slug}
        sectionTitle={section.title}
        initialBody={initialBody}
        canDeleteChapter={sectionCount > 1}
        bookTitle={bookMeta?.title ?? section.book.title}
        figureName={bookMeta?.figureName ?? ""}
        intendedAges={bookMeta?.intendedAges ?? ""}
        bookContextMarkdown={bookContextMarkdown}
      />
    </div>
  );
}
