import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BookDownloadMenu } from "@/components/book-download-menu";
import { isCalibreExportEnabled } from "@/lib/book-export";
import { prisma } from "@/lib/db";
import { EditPencilLink } from "@/components/edit-pencil-link";
import { ReportForm } from "@/components/report-form";
import { bookWatchFormAction } from "@/app/actions/book-watch";

type Props = { params: Promise<{ bookSlug: string }> };

export default async function BookPage({ params }: Props) {
  const { bookSlug } = await params;
  const session = await auth();
  const showCalibreFormats = isCalibreExportEnabled();

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      createdBy: { select: { name: true, email: true } },
      tags: { include: { tag: true } },
      sections: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!book) notFound();

  let watching = false;
  if (session?.user?.id) {
    const w = await prisma.bookWatch.findUnique({
      where: {
        userId_bookId: { userId: session.user.id, bookId: book.id },
      },
    });
    watching = !!w;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{book.title}</h1>
        <p className="mt-1 text-lg text-muted">{book.figureName}</p>
        {book.intendedAges.trim() ? (
          <p className="mt-1 text-sm text-muted">
            Age / audience: {book.intendedAges.trim()}
          </p>
        ) : null}
        {book.country.trim() ? (
          <p className="mt-1 text-sm text-muted">
            Country / region: {book.country.trim()}
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
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <BookDownloadMenu
            bookSlug={book.slug}
            showCalibreFormats={showCalibreFormats}
          />
          {session?.user ? (
            <>
              <Link
                href={`/books/${book.slug}/edit`}
                className="text-sm text-accent no-underline hover:underline"
              >
                Edit book details
              </Link>
              <form action={bookWatchFormAction}>
                <input type="hidden" name="bookSlug" value={book.slug} />
                <button
                  type="submit"
                  className="cursor-pointer text-sm text-accent underline-offset-2 hover:underline"
                >
                  {watching ? "Unwatch book" : "Watch book"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">Contents</h2>
          {session?.user ? (
            <EditPencilLink
              href={`/books/${book.slug}/edit/contents`}
              label="Edit table of contents"
            />
          ) : null}
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-6">
          {book.sections.map((s) => (
            <li key={s.id}>
              <span className="inline-flex flex-wrap items-center gap-1">
                <Link
                  href={`/books/${book.slug}/${s.slug}`}
                  className="text-accent no-underline hover:underline"
                >
                  {s.title}
                </Link>
                {session?.user ? (
                  <EditPencilLink
                    href={`/books/${book.slug}/${s.slug}/edit`}
                    label={`Edit chapter: ${s.title}`}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

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
