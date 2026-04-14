import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ContentsOrderPanel } from "@/components/contents-order-panel";
import { LocalLlmTocPanel } from "@/components/local-llm-toc-panel";
import { AddSectionForm } from "../../add-section-form";

type Props = { params: Promise<{ bookSlug: string }> };

export default async function BookEditContentsPage({ params }: Props) {
  const { bookSlug } = await params;

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, slug: true },
      },
    },
  });

  if (!book) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link
          href={`/books/${book.slug}`}
          className="text-accent no-underline hover:underline"
        >
          ← {book.title}
        </Link>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold">Edit contents</h1>
        <p className="mt-1 text-sm text-muted">
          Reorder chapters, add sections, and use optional TOC suggestions.
          Chapter text is edited from each section’s page.
        </p>
      </div>

      <ContentsOrderPanel
        bookSlug={book.slug}
        sections={book.sections}
      />

      <LocalLlmTocPanel
        bookSlug={book.slug}
        bookTitle={book.title}
        figureName={book.figureName}
        intendedAges={book.intendedAges}
        existingSlugs={book.sections.map((s) => s.slug)}
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted">Add section</h2>
        <p className="mt-1 text-xs text-muted">
          Each section has its own revision history (Wikipedia-style).
        </p>
        <div className="mt-3">
          <AddSectionForm bookSlug={book.slug} />
        </div>
      </section>
    </div>
  );
}
