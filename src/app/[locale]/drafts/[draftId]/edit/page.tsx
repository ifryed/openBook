import { BookDraftForm } from "@/components/book-draft-form";
import { ChapterDraftForm } from "@/components/chapter-draft-form";
import { auth } from "@/auth";
import { redirectToLogin } from "@/lib/auth-redirect";
import {
  isBookDraftPayload,
  isChapterDraftPayload,
} from "@/lib/content-draft-payload";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { ContentDraftKind } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; draftId: string }>;
};

export default async function EditDraftPage({ params }: Props) {
  const { locale, draftId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Drafts");

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, `/drafts/${draftId}/edit`);
  }

  const draft = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId: session.user.id },
  });
  if (!draft) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {draft.kind === ContentDraftKind.BOOK ? t("kindBook") : t("kindChapter")}
          {" · "}
          <span className="text-foreground">{draft.label}</span>
        </p>
      </div>

      {draft.kind === ContentDraftKind.BOOK &&
      isBookDraftPayload(draft.payload) ? (
        <BookDraftForm mode="edit" draftId={draftId} initial={draft.payload} />
      ) : null}

      {draft.kind === ContentDraftKind.CHAPTER &&
      isChapterDraftPayload(draft.payload) ? (
        <ChapterDraftForm mode="edit" draftId={draftId} initial={draft.payload} />
      ) : null}

      {draft.kind === ContentDraftKind.BOOK &&
      !isBookDraftPayload(draft.payload) ? (
        <p className="text-sm text-red-700">{t("corruptPayload")}</p>
      ) : null}
      {draft.kind === ContentDraftKind.CHAPTER &&
      !isChapterDraftPayload(draft.payload) ? (
        <p className="text-sm text-red-700">{t("corruptPayload")}</p>
      ) : null}

      <p className="text-sm text-muted">
        <Link href="/drafts" className="text-accent underline">
          {t("backToList")}
        </Link>
      </p>
    </div>
  );
}
