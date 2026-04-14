import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getLatestRevision } from "@/lib/revisions";
import { MarkdownBody } from "@/components/markdown-body";
import { ReportForm } from "@/components/report-form";

type Props = {
  params: Promise<{ bookSlug: string; sectionSlug: string }>;
};

export default async function SectionReadPage({ params }: Props) {
  const { bookSlug, sectionSlug } = await params;
  const session = await auth();

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: {
        select: {
          slug: true,
          title: true,
          figureName: true,
          intendedAges: true,
        },
      },
    },
  });

  if (!section) notFound();

  const revision = await getLatestRevision(section.id);

  return (
    <article className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/" className="text-accent no-underline hover:underline">
          Home
        </Link>
        {" · "}
        <Link
          href={`/books/${section.book.slug}`}
          className="text-accent no-underline hover:underline"
        >
          {section.book.title}
        </Link>
        {" · "}
        <span>{section.title}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">{section.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {section.book.figureName}
          </p>
          {section.book.intendedAges.trim() ? (
            <p className="mt-0.5 text-xs text-muted">
              Age / audience: {section.book.intendedAges.trim()}
            </p>
          ) : null}
          {revision ? (
            <p className="mt-2 text-xs text-muted">
              Last edited{" "}
              {revision.createdAt.toLocaleString()} by{" "}
              {revision.author.name ?? revision.author.email}
              {revision.summaryComment ? ` · ${revision.summaryComment}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No content yet.</p>
          )}
        </div>
        <div className="shrink-0">
          {session?.user ? (
            <Link
              href={`/books/${section.book.slug}/${section.slug}/edit`}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium !text-white no-underline hover:opacity-90 hover:!text-white hover:!no-underline"
            >
              Edit
            </Link>
          ) : (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(
                `/books/${section.book.slug}/${section.slug}/edit`,
              )}`}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted/40"
            >
              Sign in to edit
            </Link>
          )}
        </div>
      </header>

      {revision ? <MarkdownBody content={revision.body} /> : null}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
        <Link
          href={`/books/${section.book.slug}/${section.slug}/history`}
          className="text-accent no-underline hover:underline"
        >
          View history
        </Link>
      </div>

      {session?.user ? (
        <ReportForm bookSlug={section.book.slug} sectionSlug={section.slug} />
      ) : null}
    </article>
  );
}
