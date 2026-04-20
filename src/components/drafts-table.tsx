"use client";

import { DraftBookActionsCell } from "@/components/delete-draft-book-from-list";
import { DraftContentActionsCell } from "@/components/draft-delete-form";
import { Link } from "@/i18n/navigation";
import { ContentDraftKind } from "@prisma/client";
import { useTranslations } from "next-intl";

export type DraftsTableRow =
  | {
      key: string;
      kind: "draft_book";
      label: string;
      updatedAt: string;
      bookSlug: string;
    }
  | {
      key: string;
      kind: "content_draft";
      draftId: string;
      contentKind: ContentDraftKind;
      label: string;
      updatedAt: string;
    };

export function DraftsTable({
  rows,
  locale,
}: {
  rows: DraftsTableRow[];
  locale: string;
}) {
  const t = useTranslations("Drafts");

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-start">
            <th className="px-3 py-2 font-medium">{t("columnKind")}</th>
            <th className="px-3 py-2 font-medium">{t("columnLabel")}</th>
            <th className="px-3 py-2 font-medium">{t("columnUpdated")}</th>
            <th className="px-3 py-2 font-medium">{t("columnActions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border">
              <td className="px-3 py-2">
                {row.kind === "draft_book"
                  ? t("kindDraftBook")
                  : row.contentKind === ContentDraftKind.BOOK
                    ? t("kindBook")
                    : t("kindChapter")}
              </td>
              <td className="px-3 py-2 font-medium text-foreground">
                {row.kind === "draft_book" ? (
                  <Link
                    href={`/books/${row.bookSlug}/edit`}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <Link
                    href={`/drafts/${row.draftId}/edit`}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {row.label}
                  </Link>
                )}
              </td>
              <td className="px-3 py-2 text-muted">
                {new Date(row.updatedAt).toLocaleString(locale)}
              </td>
              <td className="px-3 py-2 align-top">
                {row.kind === "draft_book" ? (
                  <DraftBookActionsCell
                    bookSlug={row.bookSlug}
                    bookTitle={row.label}
                  />
                ) : (
                  <DraftContentActionsCell
                    draftId={row.draftId}
                    draftTitle={row.label}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
