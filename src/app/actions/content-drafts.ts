"use server";

import type { Prisma } from "@prisma/client";
import { ContentDraftKind } from "@prisma/client";
import {
  createDraftBook,
  createSectionFromChapterDraft,
  publishBookFromDraftInput,
  saveSectionRevision,
} from "@/app/actions/books";
import { auth } from "@/auth";
import {
  bookFormDataToPayload,
  bookPayloadChaptersToJson,
  bookPayloadToPublishFormData,
  chapterFormDataToPayload,
  isBookDraftPayload,
  isChapterDraftPayload,
  CHAPTER_DRAFT_PAYLOAD_VERSION,
  type ChapterDraftPayloadV1,
} from "@/lib/content-draft-payload";
import { withLangQuery } from "@/lib/book-locales";
import { prisma } from "@/lib/db";
import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export type ContentDraftFormState = { error?: string };

export type PublishDraftFormState = { error?: string };

export type SaveSectionEditorDraftState = { error?: string; saved?: boolean };

export type DeleteContentDraftState = { error?: string };

async function applyChapterDraftPublish(
  userId: string,
  payload: ChapterDraftPayloadV1,
): Promise<
  | { error: string }
  | { ok: true; bookSlug: string; sectionSlug: string; locale: string }
> {
  const t = await getTranslations("Errors");
  const bookSlug = payload.targetBookSlug.trim();
  const title = payload.sectionTitle.trim();
  const slugRaw = payload.sectionSlug.trim();
  const body = payload.body;
  const loc = (payload.locale || "en").trim() || "en";

  if (!bookSlug || !title) {
    return { error: t("sectionTitleRequired") };
  }

  const existingSlug = payload.existingSectionSlug?.trim();
  if (existingSlug) {
    const section = await prisma.section.findFirst({
      where: { slug: existingSlug, book: { slug: bookSlug } },
      select: { id: true },
    });
    if (!section) {
      return { error: t("sectionNotFound") };
    }
    const fd = new FormData();
    fd.set("body", body);
    fd.set("locale", loc);
    fd.set("summaryComment", "Published from draft");
    const rev = await saveSectionRevision(bookSlug, existingSlug, {}, fd);
    if (rev.error) {
      return { error: rev.error };
    }
    return { ok: true, bookSlug, sectionSlug: existingSlug, locale: loc };
  }

  const sectionRes = await createSectionFromChapterDraft(
    userId,
    bookSlug,
    title,
    slugRaw,
    body,
    loc,
  );
  if ("error" in sectionRes) {
    return { error: sectionRes.error };
  }
  return {
    ok: true,
    bookSlug: sectionRes.bookSlug,
    sectionSlug: sectionRes.sectionSlug,
    locale: loc,
  };
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function createBookDraftAction(
  _prev: ContentDraftFormState,
  formData: FormData,
): Promise<ContentDraftFormState> {
  return createDraftBook(_prev, formData);
}

export async function updateBookDraftAction(
  draftId: string,
  _prev: ContentDraftFormState,
  formData: FormData,
): Promise<ContentDraftFormState> {
  const t = await getTranslations("Errors");
  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const existing = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId, kind: ContentDraftKind.BOOK },
    select: { payload: true },
  });
  if (!existing) {
    return { error: t("draftNotFound") };
  }

  const parsed = bookFormDataToPayload(formData);
  if (!parsed.ok) {
    return { error: t("invalidChapterJson") };
  }

  const prevPayload = existing.payload as unknown;
  if (
    isBookDraftPayload(prevPayload) &&
    !parsed.payload.figureVerifiedKind.trim() &&
    parsed.payload.figureName.trim() === prevPayload.figureName.trim()
  ) {
    parsed.payload.figureVerifiedKind = prevPayload.figureVerifiedKind;
    parsed.payload.figureVerifiedKey = prevPayload.figureVerifiedKey;
  }

  await prisma.contentDraft.update({
    where: { id: draftId },
    data: {
      label: parsed.label,
      payload: parsed.payload as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePathLocalized("/drafts");
  return {};
}

/** Publish using the current form fields (edit screen), then remove the draft. */
export async function publishBookDraftFromEditForm(
  draftId: string,
  _prev: PublishDraftFormState,
  formData: FormData,
): Promise<PublishDraftFormState> {
  const t = await getTranslations("Errors");
  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const existing = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId, kind: ContentDraftKind.BOOK },
    select: { id: true, payload: true },
  });
  if (!existing) {
    return { error: t("draftNotFound") };
  }

  const parsed = bookFormDataToPayload(formData);
  if (!parsed.ok) {
    return { error: t("invalidChapterJson") };
  }

  const prevPayload = existing.payload as unknown;
  if (
    isBookDraftPayload(prevPayload) &&
    !parsed.payload.figureVerifiedKind.trim() &&
    parsed.payload.figureName.trim() === prevPayload.figureName.trim()
  ) {
    parsed.payload.figureVerifiedKind = prevPayload.figureVerifiedKind;
    parsed.payload.figureVerifiedKey = prevPayload.figureVerifiedKey;
  }

  const fd = bookPayloadToPublishFormData(parsed.payload);
  const chaptersJson = bookPayloadChaptersToJson(parsed.payload);
  const res = await publishBookFromDraftInput(userId, fd, chaptersJson);
  if ("error" in res) {
    return { error: res.error };
  }

  await prisma.contentDraft.delete({ where: { id: draftId } });
  revalidatePathLocalized("/drafts");
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${res.slug}`, res.defaultLocale)}`,
  );
}

export async function createChapterDraftAction(
  _prev: ContentDraftFormState,
  formData: FormData,
): Promise<ContentDraftFormState> {
  const t = await getTranslations("Errors");
  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const { payload, label } = chapterFormDataToPayload(formData);

  const draft = await prisma.contentDraft.create({
    data: {
      userId,
      kind: ContentDraftKind.CHAPTER,
      label,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePathLocalized("/drafts");
  const uiLocale = await getLocale();
  redirect(`/${uiLocale}/drafts/${draft.id}/edit`);
}

export async function updateChapterDraftAction(
  draftId: string,
  _prev: ContentDraftFormState,
  formData: FormData,
): Promise<ContentDraftFormState> {
  const t = await getTranslations("Errors");
  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const { payload, label } = chapterFormDataToPayload(formData);

  const updated = await prisma.contentDraft.updateMany({
    where: { id: draftId, userId },
    data: {
      label,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
  if (updated.count === 0) {
    return { error: t("draftNotFound") };
  }

  revalidatePathLocalized("/drafts");
  return {};
}

/** Publish chapter draft from edit form using current fields. */
export async function publishChapterDraftFromEditForm(
  draftId: string,
  _prev: PublishDraftFormState,
  formData: FormData,
): Promise<PublishDraftFormState> {
  const t = await getTranslations("Errors");
  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const existing = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId, kind: ContentDraftKind.CHAPTER },
    select: { id: true },
  });
  if (!existing) {
    return { error: t("draftNotFound") };
  }

  const { payload } = chapterFormDataToPayload(formData);
  const applied = await applyChapterDraftPublish(userId, payload);
  if ("error" in applied) {
    return { error: applied.error };
  }

  await prisma.contentDraft.delete({ where: { id: draftId } });
  revalidatePathLocalized("/drafts");
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(
      `/books/${applied.bookSlug}/${applied.sectionSlug}/edit`,
      applied.locale || undefined,
    )}`,
  );
}

/** Snapshot the section editor into a chapter draft (from live edit page). */
export async function saveSectionEditorAsChapterDraft(
  bookSlug: string,
  sectionSlug: string,
  locale: string,
  sectionTitle: string,
  formData: FormData,
): Promise<SaveSectionEditorDraftState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const body = formData.get("body")?.toString() ?? "";
  const label = (sectionTitle.trim() || sectionSlug).slice(0, 512);
  const payload: ChapterDraftPayloadV1 = {
    v: CHAPTER_DRAFT_PAYLOAD_VERSION,
    targetBookSlug: bookSlug,
    sectionTitle,
    sectionSlug,
    body,
    locale,
    existingSectionSlug: sectionSlug,
  };

  await prisma.contentDraft.create({
    data: {
      userId: session.user.id,
      kind: ContentDraftKind.CHAPTER,
      label,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePathLocalized("/drafts");
  return { saved: true };
}

export async function deleteContentDraftForm(
  _prev: DeleteContentDraftState,
  formData: FormData,
): Promise<DeleteContentDraftState> {
  void _prev;
  const t = await getTranslations("Errors");
  const draftId = formData.get("draftId")?.toString().trim() ?? "";
  const typedTitle = formData.get("confirmTitle")?.toString().trim() ?? "";
  if (!draftId) {
    return { error: t("invalidData") };
  }

  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const draft = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId },
    select: { id: true, label: true },
  });
  if (!draft) {
    return { error: t("draftNotFound") };
  }
  if (typedTitle !== draft.label.trim()) {
    return { error: t("deleteDraftTitleMismatch") };
  }

  await prisma.contentDraft.delete({ where: { id: draft.id } });

  revalidatePathLocalized("/drafts");
  const uiLocale = await getLocale();
  redirect(`/${uiLocale}/drafts`);
  return {};
}

export async function publishContentDraftForm(
  _prev: PublishDraftFormState,
  formData: FormData,
): Promise<PublishDraftFormState> {
  const t = await getTranslations("Errors");
  const draftId = formData.get("draftId")?.toString().trim() ?? "";
  if (!draftId) {
    return { error: t("invalidData") };
  }

  const userId = await requireUserId();
  if (!userId) {
    return { error: t("signInRequired") };
  }

  const draft = await prisma.contentDraft.findFirst({
    where: { id: draftId, userId },
  });
  if (!draft) {
    return { error: t("draftNotFound") };
  }

  const uiLocale = await getLocale();

  if (draft.kind === ContentDraftKind.BOOK) {
    const raw = draft.payload as unknown;
    if (!isBookDraftPayload(raw)) {
      return { error: t("invalidData") };
    }
    const fd = bookPayloadToPublishFormData(raw);
    const chaptersJson = bookPayloadChaptersToJson(raw);
    const res = await publishBookFromDraftInput(userId, fd, chaptersJson);
    if ("error" in res) {
      return { error: res.error };
    }
    await prisma.contentDraft.delete({ where: { id: draftId } });
    revalidatePathLocalized("/drafts");
    redirect(
      `/${uiLocale}${withLangQuery(`/books/${res.slug}`, res.defaultLocale)}`,
    );
  }

  if (draft.kind === ContentDraftKind.CHAPTER) {
    const raw = draft.payload as unknown;
    if (!isChapterDraftPayload(raw)) {
      return { error: t("invalidData") };
    }
    const applied = await applyChapterDraftPublish(userId, raw);
    if ("error" in applied) {
      return { error: applied.error };
    }
    await prisma.contentDraft.delete({ where: { id: draftId } });
    revalidatePathLocalized("/drafts");
    redirect(
      `/${uiLocale}${withLangQuery(
        `/books/${applied.bookSlug}/${applied.sectionSlug}/edit`,
        applied.locale || undefined,
      )}`,
    );
  }

  return { error: t("invalidData") };
}
