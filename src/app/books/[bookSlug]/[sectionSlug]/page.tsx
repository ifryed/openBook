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

      <header>
        <h1 className="text-3xl font-semibold">{section.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {section.book.figureName}
        </p>
        {section.book.intendedAges.trim() ? (
          <p className="mt-0.5 text-xs text-muted">
            Intended for: {section.book.intendedAges.trim()}
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
      </header>

      {revision ? <MarkdownBody content={revision.body} /> : null}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
        <Link
          href={`/books/${section.book.slug}/${section.slug}/history`}
          className="text-accent no-underline hover:underline"
        >
          View history
        </Link>
        {session?.user ? (
          <Link
            href={`/books/${section.book.slug}/${section.slug}/edit`}
            className="text-accent no-underline hover:underline"
          >
            Edit
          </Link>
        ) : (
          <Link href="/login" className="text-muted no-underline hover:underline">
            Sign in to edit
          </Link>
        )}
      </div>

      {session?.user ? (
        <ReportForm bookSlug={section.book.slug} sectionSlug={section.slug} />
      ) : null}
    </article>
  );
}
