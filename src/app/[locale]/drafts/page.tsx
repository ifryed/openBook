import { DraftsTable, type DraftsTableRow } from "@/components/drafts-table";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirectToLogin } from "@/lib/auth-redirect";
import { Link } from "@/i18n/navigation";
import { ContentDraftKind } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

type MergedDraftRow =
  | {
      key: string;
      kind: "draft_book";
      label: string;
      updatedAt: Date;
      bookSlug: string;
    }
  | {
      key: string;
      kind: "content_draft";
      draftId: string;
      contentKind: ContentDraftKind;
      label: string;
      updatedAt: Date;
    };

export default async function DraftsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Drafts");

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/drafts");
  }

  const [draftBooks, contentRows] = await Promise.all([
    prisma.book.findMany({
      where: { createdById: session.user.id, isDraft: true },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, title: true, updatedAt: true },
    }),
    prisma.contentDraft.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        kind: true,
        label: true,
        updatedAt: true,
      },
    }),
  ]);

  const merged: MergedDraftRow[] = [
    ...draftBooks.map((b) => ({
      key: `book:${b.slug}`,
      kind: "draft_book" as const,
      label: b.title,
      updatedAt: b.updatedAt,
      bookSlug: b.slug,
    })),
    ...contentRows.map((row) => ({
      key: `draft:${row.id}`,
      kind: "content_draft" as const,
      draftId: row.id,
      contentKind: row.kind,
      label: row.label,
      updatedAt: row.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const tableRows: DraftsTableRow[] = merged.map((row) =>
    row.kind === "draft_book"
      ? {
          key: row.key,
          kind: "draft_book",
          label: row.label,
          updatedAt: row.updatedAt.toISOString(),
          bookSlug: row.bookSlug,
        }
      : {
          key: row.key,
          kind: "content_draft",
          draftId: row.draftId,
          contentKind: row.contentKind,
          label: row.label,
          updatedAt: row.updatedAt.toISOString(),
        },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
        </div>
        <Link
          href="/drafts/new/book"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium !text-white visited:!text-white hover:!text-white hover:opacity-90 no-underline hover:no-underline"
        >
          {t("newDraftBook")}
        </Link>
      </div>

      {merged.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <DraftsTable rows={tableRows} locale={locale} />
      )}

      <p className="text-sm text-muted">
        <Link href="/" className="text-accent underline">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
