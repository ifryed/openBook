import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminDeleteBookForm } from "@/components/admin-delete-book-form";
import { prisma } from "@/lib/db";
import { EditBookForm } from "./edit-book-form";

type Props = { params: Promise<{ bookSlug: string }> };

export default async function BookEditPage({ params }: Props) {
  const { bookSlug } = await params;
  const session = await auth();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      tags: { include: { tag: true } },
    },
  });

  if (!book) notFound();

  const tagsDisplay = book.tags.map((bt) => bt.tag.name).join(", ");

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
        <h1 className="text-2xl font-semibold">Edit book details</h1>
      </div>
      <EditBookForm
        bookSlug={book.slug}
        title={book.title}
        figureName={book.figureName}
        intendedAges={book.intendedAges}
        country={book.country}
        summary={book.summary}
        slug={book.slug}
        tagsDisplay={tagsDisplay}
      />
      {session?.user?.isAdmin ? (
        <AdminDeleteBookForm bookSlug={book.slug} bookTitle={book.title} />
      ) : null}
    </div>
  );
}
