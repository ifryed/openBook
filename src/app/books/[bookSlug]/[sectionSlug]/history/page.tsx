import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { listRevisions } from "@/lib/revisions";
import { DiffView } from "@/components/diff-view";
import { revertSectionFromForm } from "@/app/actions/books";

type Props = {
  params: Promise<{ bookSlug: string; sectionSlug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function SectionHistoryPage({
  params,
  searchParams,
}: Props) {
  const { bookSlug, sectionSlug } = await params;
  const { from: fromId, to: toId } = await searchParams;
  const session = await auth();

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

  const revisions = await listRevisions(section.id);

  const fromRev = fromId
    ? revisions.find((r) => r.id === fromId)
    : revisions[1] ?? null;
  const toRev = toId
    ? revisions.find((r) => r.id === toId)
    : revisions[0] ?? null;

  const oldText = fromRev?.body ?? "";
  const newText = toRev?.body ?? "";

  return (
    <div className="space-y-8">
      <nav className="text-sm text-muted">
        <Link
          href={`/books/${section.book.slug}/${section.slug}`}
          className="text-accent no-underline hover:underline"
        >
          ← {section.title}
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">Revision history</h1>
        <p className="mt-1 text-sm text-muted">
          {section.book.title} — {section.title}
        </p>
      </div>

      {fromRev && toRev && fromRev.id !== toRev.id ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Diff</h2>
          <p className="text-xs text-muted">
            Comparing older → newer.{" "}
            <Link
              href={`/books/${section.book.slug}/${section.slug}/history`}
              className="text-accent"
            >
              Reset to latest pair
            </Link>
          </p>
          <DiffView oldText={oldText} newText={newText} />
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-medium">Revisions</h2>
        <ul className="mt-3 space-y-3">
          {revisions.map((r, i) => {
            const older = revisions[i + 1];
            return (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {r.createdAt.toLocaleString()}
                  </span>
                  <span className="text-muted">
                    {r.author.name ?? r.author.email}
                  </span>
                </div>
                {r.summaryComment ? (
                  <p className="mt-1 text-muted">{r.summaryComment}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {older ? (
                    <Link
                      href={`/books/${section.book.slug}/${section.slug}/history?from=${older.id}&to=${r.id}`}
                      className="text-accent no-underline hover:underline"
                    >
                      Diff vs previous
                    </Link>
                  ) : null}
                  {session?.user && revisions[0]?.id !== r.id ? (
                    <form action={revertSectionFromForm}>
                      <input type="hidden" name="bookSlug" value={bookSlug} />
                      <input
                        type="hidden"
                        name="sectionSlug"
                        value={sectionSlug}
                      />
                      <input type="hidden" name="revisionId" value={r.id} />
                      <button
                        type="submit"
                        className="cursor-pointer text-accent underline-offset-2 hover:underline"
                      >
                        Revert to this
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
