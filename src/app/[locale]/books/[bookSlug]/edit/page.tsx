import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminDeleteBookForm } from "@/components/admin-delete-book-form";
import { DeleteDraftBookForm } from "@/components/delete-draft-book-form";
import { PublishDraftBookPanel } from "@/components/publish-draft-book-panel";
import { prisma } from "@/lib/db";
import { canViewBook } from "@/lib/book-visibility";
import { BookLanguagesManager } from "@/components/book-languages-manager";
import { EditBookForm } from "./edit-book-form";
import { getTranslations } from "next-intl/server";

type Props = { params: Promise<{ bookSlug: string }> };

export default async function BookEditPage({ params }: Props) {
  const { bookSlug } = await params;
  const session = await auth();
  const tDrafts = await getTranslations("Drafts");

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      tags: { include: { tag: true } },
      languages: { select: { locale: true } },
    },
  });

  if (!book) notFound();
  if (
    !canViewBook(
      { isDraft: book.isDraft, createdById: book.createdById },
      session,
    )
  ) {
    notFound();
  }

  const tagsDisplay = book.tags.map((bt) => bt.tag.name).join(", ");
  const showDraftTools =
    book.isDraft &&
    session?.user?.id &&
    (session.user.id === book.createdById || session.user.isAdmin);

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
      <BookLanguagesManager
        bookSlug={book.slug}
        locales={book.languages.map((l) => l.locale)}
        defaultLocale={book.defaultLocale}
      />
      <EditBookForm
        bookSlug={book.slug}
        title={book.title}
        figureName={book.figureName}
        intendedAges={book.intendedAges}
        country={book.country}
        summary={book.summary}
        slug={book.slug}
        tagsDisplay={tagsDisplay}
        bookLanguages={book.languages.map((l) => l.locale)}
        bookDefaultLocale={book.defaultLocale}
      />
      {showDraftTools ? (
        <section
          className="space-y-6 border-t border-border pt-6"
          aria-label={tDrafts("draftBookActionsAriaLabel")}
        >
          <PublishDraftBookPanel
            bookSlug={book.slug}
            figureName={book.figureName}
          />
          <DeleteDraftBookForm bookSlug={book.slug} bookTitle={book.title} />
        </section>
      ) : null}
      {session?.user?.isAdmin ? (
        <AdminDeleteBookForm bookSlug={book.slug} bookTitle={book.title} />
      ) : null}
    </div>
  );
}
