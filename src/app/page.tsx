import Link from "next/link";
import { prisma } from "@/lib/db";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const books = await prisma.book.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { figureName: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      tags: { include: { tag: true } },
      _count: { select: { sections: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Historical figure books
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          OpenBook is a wiki-style library: anyone can sign up, start a book
          about a historical figure, and collaborate with revisions and
          history—like Wikipedia, focused on biographies.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" action="/" method="get">
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by figure, title, or URL…"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      {books.length === 0 ? (
        <p className="text-muted">
          {query
            ? "No books match your search."
            : "No books yet. Sign in and create the first one."}
        </p>
      ) : (
        <ul className="space-y-4">
          {books.map((book) => (
            <li
              key={book.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <Link
                href={`/books/${book.slug}`}
                className="text-lg font-medium text-foreground no-underline hover:underline"
              >
                {book.title}
              </Link>
              <p className="text-sm text-muted">
                Figure: {book.figureName} · {book._count.sections} sections
              </p>
              {book.summary ? (
                <p className="mt-2 line-clamp-2 text-sm text-foreground">
                  {book.summary}
                </p>
              ) : null}
              {book.tags.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {book.tags.map((bt) => bt.tag.name).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
