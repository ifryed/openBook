import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LocalLlmTocPanel } from "@/components/local-llm-toc-panel";
import { ReportForm } from "@/components/report-form";
import { AddSectionForm } from "./add-section-form";

type Props = { params: Promise<{ bookSlug: string }> };

export default async function BookPage({ params }: Props) {
  const { bookSlug } = await params;
  const session = await auth();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      createdBy: { select: { name: true, email: true } },
      tags: { include: { tag: true } },
      sections: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!book) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{book.title}</h1>
        <p className="mt-1 text-lg text-muted">{book.figureName}</p>
        {book.intendedAges.trim() ? (
          <p className="mt-1 text-sm text-muted">
            Intended for: {book.intendedAges.trim()}
          </p>
        ) : null}
        {book.summary ? (
          <p className="mt-4 text-foreground">{book.summary}</p>
        ) : null}
        <p className="mt-4 text-sm text-muted">
          Started by {book.createdBy.name ?? book.createdBy.email} · Updated{" "}
          {book.updatedAt.toLocaleDateString()}
        </p>
        {book.tags.length > 0 ? (
          <p className="mt-2 text-sm text-muted">
            {book.tags.map((bt) => bt.tag.name).join(" · ")}
          </p>
        ) : null}
        {session?.user ? (
          <p className="mt-4">
            <Link
              href={`/books/${book.slug}/edit`}
              className="text-sm text-accent no-underline hover:underline"
            >
              Edit book details
            </Link>
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="text-lg font-medium">Contents</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6">
          {book.sections.map((s) => (
            <li key={s.id}>
              <Link
                href={`/books/${book.slug}/${s.slug}`}
                className="text-accent no-underline hover:underline"
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {session?.user ? (
        <LocalLlmTocPanel
          bookSlug={book.slug}
          bookTitle={book.title}
          figureName={book.figureName}
          intendedAges={book.intendedAges}
          existingSlugs={book.sections.map((s) => s.slug)}
        />
      ) : null}

      {session?.user ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted">Add section</h2>
          <p className="mt-1 text-xs text-muted">
            Each section has its own revision history (Wikipedia-style).
          </p>
          <div className="mt-3">
            <AddSectionForm bookSlug={book.slug} />
          </div>
        </section>
      ) : null}

      {session?.user ? (
        <ReportForm bookSlug={book.slug} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login">Sign in</Link> to report issues with this book.
        </p>
      )}
    </div>
  );
}
