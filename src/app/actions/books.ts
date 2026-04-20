"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  assertCanCreateBook,
  assertCanCreateRevision,
  assertRevisionBudget,
} from "@/lib/rate-limit";
import {
  createRevision,
  getLatestRevision,
  revertToRevision,
} from "@/lib/revisions";
import { resolveSectionTitle } from "@/lib/section-localization";
import { dispatchNotificationEmails } from "@/lib/notification-email-dispatch";
import { notifyBookActivityTx, notifyNewBookDigestTx } from "@/lib/notifications";
import { awardReputationTx } from "@/lib/reputation";
import { assertFigurePickInSearchResults } from "@/lib/figure-candidates";
import { isKnownIntendedAudience } from "@/lib/intended-audience";
import {
  MAX_AUTO_WIZARD_PUBLISH_SECTIONS,
  MAX_LLM_TOC_SECTIONS,
} from "@/lib/book-limits";
import {
  DEFAULT_BOOK_LOCALE,
  isKnownBookLocale,
  normalizeActiveLocale,
  withLangQuery,
} from "@/lib/book-locales";
import {
  defaultBookSlug,
  isReservedSlug,
  uniqueSlugFromPreferred,
  slugify,
} from "@/lib/slug";

async function requireVerifiedFigurePick(
  figureName: string,
  kindRaw: string | null,
  keyRaw: string | null,
): Promise<BookFormState | null> {
  const t = await getTranslations("Errors");
  const kind = kindRaw?.trim() ?? "";
  const key = keyRaw?.trim() ?? "";
  if (kind !== "wikipedia" && kind !== "wikidata") {
    return { error: t("figurePick") };
  }
  const ok = await assertFigurePickInSearchResults(
    figureName,
    kind as "wikipedia" | "wikidata",
    key,
  );
  if (!ok) {
    return { error: t("figurePickStale") };
  }
  return null;
}

export type BookFormState = { error?: string };

function parseTags(raw: string | null): { slug: string; name: string }[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: { slug: string; name: string }[] = [];
  for (const p of parts) {
    const slug = slugify(p);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name: p.slice(0, 64) });
  }
  return out;
}

type ValidatedCreateBook = {
  slug: string;
  title: string;
  figureName: string;
  intendedAges: string;
  country: string;
  summary: string | null;
  tags: ReturnType<typeof parseTags>;
  /** BCP-47 codes; always non-empty. */
  languages: string[];
  defaultLocale: string;
  /** When true, creates slug `introduction` with a starter revision (auto wizard replaces it with an AI draft). */
  includeIntroduction: boolean;
};

type ValidateCreateBookOptions = {
  /** When true, figure Wikipedia/Wikidata verification is not required (draft book creation). */
  skipFigureVerification?: boolean;
};

async function validateCreateBookForm(
  formData: FormData,
  options?: ValidateCreateBookOptions,
): Promise<BookFormState | ValidatedCreateBook> {
  const t = await getTranslations("Errors");
  const title = formData.get("title")?.toString().trim() ?? "";
  const figureName = formData.get("figureName")?.toString().trim() ?? "";
  const intendedAges = formData.get("intendedAges")?.toString().trim() ?? "";
  const country = formData.get("country")?.toString().trim() ?? "";
  const summary = formData.get("summary")?.toString().trim() || null;
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const tagsRaw = formData.get("tags")?.toString() ?? "";

  if (country.length > 255) {
    return { error: t("countryTooLong") };
  }

  if (!title || !figureName) {
    return { error: t("titleFigureRequired") };
  }

  const slug = slugRaw ? slugify(slugRaw) : defaultBookSlug(figureName, title);
  if (!slug) {
    return { error: t("slugDerive") };
  }
  if (isReservedSlug(slug)) {
    return { error: t("slugReserved") };
  }
  if (!intendedAges) {
    return { error: t("intendedAgesRequired") };
  }
  if (!isKnownIntendedAudience(intendedAges)) {
    return { error: t("intendedAgesInvalid") };
  }

  if (!options?.skipFigureVerification) {
    const pickErr = await requireVerifiedFigurePick(
      figureName,
      formData.get("figureVerifiedKind")?.toString() ?? null,
      formData.get("figureVerifiedKey")?.toString() ?? null,
    );
    if (pickErr) return pickErr;
  }

  const tags = parseTags(tagsRaw);
  const defaultLocaleRaw =
    formData.get("defaultLocale")?.toString().trim() || DEFAULT_BOOK_LOCALE;
  if (!isKnownBookLocale(defaultLocaleRaw)) {
    return { error: t("primaryLanguageInvalid") };
  }
  const languages = [defaultLocaleRaw];
  const includeIntroduction =
    formData.get("includeIntroduction") === "on" ||
    formData.get("includeIntroduction") === "true";
  return {
    slug,
    title,
    figureName,
    intendedAges,
    country,
    summary,
    tags,
    languages,
    defaultLocale: defaultLocaleRaw,
    includeIntroduction,
  };
}

function isValidatedCreateBook(
  v: BookFormState | ValidatedCreateBook,
): v is ValidatedCreateBook {
  return "slug" in v && typeof (v as ValidatedCreateBook).slug === "string";
}

type InsertNewBookOptions = { isDraft?: boolean };

async function insertNewBook(
  userId: string,
  v: ValidatedCreateBook,
  options?: InsertNewBookOptions,
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  const isDraft = options?.isDraft ?? false;
  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          slug: v.slug,
          title: v.title,
          figureName: v.figureName,
          intendedAges: v.intendedAges,
          country: v.country,
          summary: v.summary,
          defaultLocale: v.defaultLocale,
          createdById: userId,
          isDraft,
          languages: {
            create: v.languages.map((locale) => ({ locale })),
          },
        },
      });

      await tx.bookLocalization.create({
        data: {
          bookId: book.id,
          locale: v.defaultLocale,
          title: v.title,
        },
      });

      for (const t of v.tags) {
        const tag = await tx.tag.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, name: t.name },
          update: { name: t.name },
        });
        await tx.bookTag.create({
          data: { bookId: book.id, tagId: tag.id },
        });
      }

      let refSectionId: string | null = null;
      let refRevisionId: string | null = null;
      if (v.includeIntroduction) {
        const section = await tx.section.create({
          data: {
            bookId: book.id,
            slug: "introduction",
            orderIndex: 0,
            localizations: {
              create: {
                locale: v.defaultLocale,
                title: "Introduction",
              },
            },
          },
        });
        refSectionId = section.id;
        const introRevision = await tx.revision.create({
          data: {
            sectionId: section.id,
            authorId: userId,
            locale: v.defaultLocale,
            body:
              "This book has just been created. **Edit this introduction** to begin the biography.",
            summaryComment: "Initial revision",
          },
        });
        refRevisionId = introRevision.id;
      }

      if (!isDraft) {
        await awardReputationTx(tx, userId, "BOOK_CREATED", {
          refBookId: book.id,
          refSectionId,
          refRevisionId,
        });
        return await notifyNewBookDigestTx(tx, book.id, userId);
      }
      return [] as string[];
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : t("couldNotCreateBook");
    if (msg.includes("Unique constraint")) {
      return { error: t("slugExists") };
    }
    return { error: msg };
  }

  return {};
}

export async function createBook(
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const validated = await validateCreateBookForm(formData);
  if (!isValidatedCreateBook(validated)) {
    return validated;
  }

  try {
    await assertCanCreateBook(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  const err = await insertNewBook(session.user.id, validated);
  if (err.error) return err;

  revalidatePathLocalized("/");
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${validated.slug}`, validated.defaultLocale)}`,
  );
  return {};
}

/**
 * Creates a real book row in draft mode (no figure verification, no public catalog listing).
 * Redirects to the book edit screen so the author can use TOC, chapters, and normal flows.
 */
export async function createDraftBook(
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const validated = await validateCreateBookForm(formData, {
    skipFigureVerification: true,
  });
  if (!isValidatedCreateBook(validated)) {
    return validated;
  }

  try {
    await assertCanCreateBook(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  const err = await insertNewBook(session.user.id, validated, {
    isDraft: true,
  });
  if (err.error) return err;

  revalidatePathLocalized("/drafts");
  const uiLocale = await getLocale();
  const afterSave = formData.get("draftAfterSave")?.toString().trim();
  const suffix =
    afterSave === "contents" ? "/edit/contents" : "/edit";
  redirect(`/${uiLocale}/books/${validated.slug}${suffix}`);
  return {};
}

function userMayEditDraftBook(
  book: { isDraft: boolean; createdById: string },
  userId: string,
  isAdmin: boolean,
): boolean {
  if (!book.isDraft) return true;
  return isAdmin || userId === book.createdById;
}

type WizardPublishChapterRow = { slug: string; title: string; body: string };

async function normalizeWizardPublishChapters(items: unknown): Promise<
  | { ok: true; chapters: WizardPublishChapterRow[] }
  | { error: string }
> {
  const t = await getTranslations("Errors");
  if (!Array.isArray(items) || items.length === 0) {
    return { error: t("noChaptersPublish") };
  }
  if (items.length > MAX_AUTO_WIZARD_PUBLISH_SECTIONS) {
    return {
      error: t("maxWizardSections", {
        max: MAX_AUTO_WIZARD_PUBLISH_SECTIONS,
      }),
    };
  }
  const out: WizardPublishChapterRow[] = [];
  const seen = new Set<string>();
  for (const row of items) {
    if (!row || typeof row !== "object") {
      return { error: t("invalidChapterData") };
    }
    const r = row as Record<string, unknown>;
    const title =
      typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    const body = typeof r.body === "string" ? r.body.trim() : "";
    const slugRaw = typeof r.slug === "string" ? r.slug.trim() : "";
    const slug = slugify(slugRaw || title);
    if (!title || !body || !slug) {
      return { error: t("chapterNeedsBody") };
    }
    if (isReservedSlug(slug)) {
      return { error: t("reservedSlug", { slug }) };
    }
    const lower = slug.toLowerCase();
    if (seen.has(lower)) {
      return { error: t("duplicateSlug", { slug }) };
    }
    seen.add(lower);
    out.push({ slug, title, body });
  }
  return { ok: true, chapters: out };
}

async function insertPublishedAutoWizardBook(
  userId: string,
  v: ValidatedCreateBook,
  chapters: WizardPublishChapterRow[],
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          slug: v.slug,
          title: v.title,
          figureName: v.figureName,
          intendedAges: v.intendedAges,
          country: v.country,
          summary: v.summary,
          defaultLocale: v.defaultLocale,
          createdById: userId,
          languages: {
            create: v.languages.map((locale) => ({ locale })),
          },
        },
      });

      await tx.bookLocalization.create({
        data: {
          bookId: book.id,
          locale: v.defaultLocale,
          title: v.title,
        },
      });

      for (const t of v.tags) {
        const tag = await tx.tag.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, name: t.name },
          update: { name: t.name },
        });
        await tx.bookTag.create({
          data: { bookId: book.id, tagId: tag.id },
        });
      }

      let firstSectionId: string | null = null;
      let firstRevisionId: string | null = null;
      const revisionEmailIds: string[] = [];

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]!;
        const section = await tx.section.create({
          data: {
            bookId: book.id,
            slug: ch.slug,
            orderIndex: i,
            localizations: {
              create: {
                locale: v.defaultLocale,
                title: ch.title,
              },
            },
          },
        });
        const rev = await tx.revision.create({
          data: {
            sectionId: section.id,
            authorId: userId,
            locale: v.defaultLocale,
            body: ch.body,
            summaryComment: "Auto-wizard draft",
          },
        });
        if (i === 0) {
          firstSectionId = section.id;
          firstRevisionId = rev.id;
        }
        await awardReputationTx(tx, userId, "REVISION_SAVED", {
          refBookId: book.id,
          refSectionId: section.id,
          refRevisionId: rev.id,
        });
        revisionEmailIds.push(
          ...(await notifyBookActivityTx(tx, {
            bookId: book.id,
            actorId: userId,
            type: "NEW_REVISION",
            sectionId: section.id,
            revisionId: rev.id,
          })),
        );
      }

      await awardReputationTx(tx, userId, "BOOK_CREATED", {
        refBookId: book.id,
        refSectionId: firstSectionId,
        refRevisionId: firstRevisionId,
      });
      const digestIds = await notifyNewBookDigestTx(tx, book.id, userId);
      return [...revisionEmailIds, ...digestIds];
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : t("couldNotPublishBook");
    if (msg.includes("Unique constraint")) {
      return { error: t("slugExists") };
    }
    return { error: msg };
  }

  return {};
}

export async function assertAutoWizardPublishPreconditions(
  sectionCount: number,
): Promise<{ ok: true } | { error: string }> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }
  if (
    sectionCount < 1 ||
    sectionCount > MAX_AUTO_WIZARD_PUBLISH_SECTIONS
  ) {
    return {
      error: t("wizardSectionRange", { max: MAX_AUTO_WIZARD_PUBLISH_SECTIONS }),
    };
  }
  try {
    await assertCanCreateBook(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }
  try {
    await assertRevisionBudget(session.user.id, sectionCount);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }
  return { ok: true };
}

export type PublishAutoWizardResult =
  | { ok: true; slug: string; defaultLocale: string }
  | { error: string };

/**
 * Creates the book and all section revisions in one transaction (after client-side AI drafting).
 */
export async function publishAutoWizardBook(
  formData: FormData,
  chaptersJson: string,
): Promise<PublishAutoWizardResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(chaptersJson) as unknown;
  } catch {
    return { error: t("invalidChapterData") };
  }

  const normalized = await normalizeWizardPublishChapters(parsed);
  if ("error" in normalized) {
    return { error: normalized.error };
  }
  const chapters = normalized.chapters;

  const validated = await validateCreateBookForm(formData);
  if (!isValidatedCreateBook(validated)) {
    return { error: validated.error ?? t("invalidForm") };
  }

  const pre = await assertAutoWizardPublishPreconditions(chapters.length);
  if ("error" in pre) {
    return { error: pre.error };
  }

  const err = await insertPublishedAutoWizardBook(
    session.user.id,
    validated,
    chapters,
  );
  if (err.error) {
    return { error: err.error };
  }

  revalidatePathLocalized("/");
  revalidatePathLocalized(`/books/${validated.slug}`);
  return {
    ok: true,
    slug: validated.slug,
    defaultLocale: validated.defaultLocale,
  };
}

export type PublishBookFromDraftInputResult =
  | { ok: true; slug: string; defaultLocale: string }
  | { error: string };

/**
 * Validates full create-book rules (including figure pick) and publishes either a
 * plain book (`insertNewBook`) or book + wizard chapters (`insertPublishedAutoWizardBook`).
 * Caller handles draft row deletion and redirects.
 */
export async function publishBookFromDraftInput(
  userId: string,
  formData: FormData,
  chaptersJson: string | null,
): Promise<PublishBookFromDraftInputResult> {
  const t = await getTranslations("Errors");
  const validated = await validateCreateBookForm(formData);
  if (!isValidatedCreateBook(validated)) {
    return { error: validated.error ?? t("invalidForm") };
  }

  let chaptersPayload: string | null = chaptersJson?.trim() ?? null;
  if (chaptersPayload === "" || chaptersPayload === "[]") {
    chaptersPayload = null;
  }

  if (chaptersPayload) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(chaptersPayload) as unknown;
    } catch {
      return { error: t("invalidChapterData") };
    }
    const normalized = await normalizeWizardPublishChapters(parsed);
    if ("error" in normalized) {
      return { error: normalized.error };
    }
    const pre = await assertAutoWizardPublishPreconditions(
      normalized.chapters.length,
    );
    if ("error" in pre) {
      return { error: pre.error };
    }
    const err = await insertPublishedAutoWizardBook(
      userId,
      validated,
      normalized.chapters,
    );
    if (err.error) {
      return { error: err.error };
    }
  } else {
    try {
      await assertCanCreateBook(userId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : t("rateLimited") };
    }
    const err = await insertNewBook(userId, validated);
    if (err.error) {
      return { error: err.error };
    }
  }

  revalidatePathLocalized("/");
  revalidatePathLocalized(`/books/${validated.slug}`);
  return {
    ok: true,
    slug: validated.slug,
    defaultLocale: validated.defaultLocale,
  };
}

/**
 * Publishes a draft book (sets `isDraft` false) after verifying the figure pick.
 * Awards book creation reputation and digest notification if not already recorded.
 */
export async function publishDraftBook(
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const bookSlug = formData.get("bookSlug")?.toString().trim() ?? "";
  if (!bookSlug) {
    return { error: t("invalidForm") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      isDraft: true,
      createdById: true,
      figureName: true,
      defaultLocale: true,
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (
    !userMayEditDraftBook(book, session.user.id, Boolean(session.user.isAdmin))
  ) {
    return { error: t("onlyCreatorWizard") };
  }
  if (!book.isDraft) {
    return { error: t("bookNotDraft") };
  }

  const pickErr = await requireVerifiedFigurePick(
    book.figureName,
    formData.get("figureVerifiedKind")?.toString() ?? null,
    formData.get("figureVerifiedKey")?.toString() ?? null,
  );
  if (pickErr) return pickErr;

  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: book.id },
        data: { isDraft: false },
      });

      const already = await tx.reputationEvent.findFirst({
        where: {
          userId: session.user.id,
          kind: "BOOK_CREATED",
          refBookId: book.id,
        },
      });
      if (!already) {
        const firstSection = await tx.section.findFirst({
          where: { bookId: book.id },
          orderBy: { orderIndex: "asc" },
          select: { id: true },
        });
        let refSectionId: string | null = null;
        let refRevisionId: string | null = null;
        if (firstSection) {
          refSectionId = firstSection.id;
          const latest = await getLatestRevision(
            firstSection.id,
            book.defaultLocale,
            tx,
          );
          refRevisionId = latest?.id ?? null;
        }
        await awardReputationTx(tx, session.user.id, "BOOK_CREATED", {
          refBookId: book.id,
          refSectionId,
          refRevisionId,
        });
      }
      return await notifyNewBookDigestTx(tx, book.id, session.user.id);
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : t("couldNotUpdateBook"),
    };
  }

  revalidatePathLocalized("/");
  revalidatePathLocalized("/drafts");
  revalidatePathLocalized(`/books/${bookSlug}`, "layout");
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${bookSlug}`, book.defaultLocale)}`,
  );
  return {};
}

export type DeleteDraftBookState = { error?: string };

/** Permanently deletes a draft book owned by the signed-in user (or admin). */
export async function deleteDraftBookAsOwner(
  _prev: DeleteDraftBookState,
  formData: FormData,
): Promise<DeleteDraftBookState> {
  void _prev;
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const bookSlug = formData.get("bookSlug")?.toString().trim() ?? "";
  if (!bookSlug) {
    return { error: t("missingBook") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: { id: true, title: true, isDraft: true, createdById: true },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (!book.isDraft) {
    return { error: t("bookNotDraft") };
  }
  if (
    book.createdById !== session.user.id &&
    !session.user.isAdmin
  ) {
    return { error: t("onlyCreatorWizard") };
  }

  const typedTitle = formData.get("confirmTitle")?.toString().trim() ?? "";
  if (typedTitle !== book.title.trim()) {
    return { error: t("deleteTitleMismatch") };
  }

  await prisma.book.delete({ where: { id: book.id } });

  revalidatePathLocalized("/");
  revalidatePathLocalized("/drafts");
  revalidatePathLocalized(`/books/${bookSlug}`, "layout");
  const uiLocale = await getLocale();
  redirect(`/${uiLocale}/drafts`);
  return {};
}

export type CreateSectionFromChapterDraftResult =
  | { ok: true; bookSlug: string; sectionSlug: string }
  | { error: string };

/** Creates a new section with the given Markdown body (used by content drafts publish). */
export async function createSectionFromChapterDraft(
  userId: string,
  bookSlug: string,
  title: string,
  slugRaw: string,
  body: string,
  localeRaw: string,
): Promise<CreateSectionFromChapterDraftResult> {
  const t = await getTranslations("Errors");
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return { error: t("contentEmpty") };
  }

  const slug = slugRaw.trim() ? slugify(slugRaw.trim()) : slugify(title);
  if (!title.trim() || !slug) {
    return { error: t("sectionTitleRequired") };
  }
  if (isReservedSlug(slug)) {
    return { error: t("sectionSlugReserved") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      defaultLocale: true,
      isDraft: true,
      createdById: true,
      languages: { select: { locale: true } },
      sections: {
        orderBy: { orderIndex: "desc" },
        take: 1,
        select: { orderIndex: true },
      },
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  if (
    !userMayEditDraftBook(
      book,
      userId,
      Boolean(actor?.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }

  const allowed = book.languages.map((l) => l.locale);
  const locale = normalizeActiveLocale(
    localeRaw,
    allowed,
    book.defaultLocale,
  );

  try {
    await assertCanCreateRevision(userId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug,
          orderIndex: (book.sections[0]?.orderIndex ?? -1) + 1,
          localizations: {
            create: { locale, title: title.trim() },
          },
        },
      });
      const rev = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: userId,
          locale,
          body: trimmedBody,
          summaryComment: "Published from draft",
        },
      });
      await awardReputationTx(tx, userId, "SECTION_ADDED", {
        refBookId: book.id,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      return await notifyBookActivityTx(tx, {
        bookId: book.id,
        actorId: userId,
        type: "NEW_SECTION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes("Unique constraint")
    ) {
      return { error: t("sectionExists") };
    }
    return { error: e instanceof Error ? e.message : t("addSectionFailed") };
  }

  revalidatePathLocalized(`/books/${bookSlug}`);
  return { ok: true, bookSlug, sectionSlug: slug };
}

/**
 * Update book metadata and tags. `currentSlug` is the book’s slug when the form was loaded.
 */
export async function updateBook(
  currentSlug: string,
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: currentSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      figureName: true,
      intendedAges: true,
      country: true,
      summary: true,
      defaultLocale: true,
      isDraft: true,
      createdById: true,
      languages: { select: { locale: true } },
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }

  const title = formData.get("title")?.toString().trim() ?? "";
  const figureName = formData.get("figureName")?.toString().trim() ?? "";
  const intendedAges = formData.get("intendedAges")?.toString().trim() ?? "";
  const country = formData.get("country")?.toString().trim() ?? "";
  const summary = formData.get("summary")?.toString().trim() || null;
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const tagsRaw = formData.get("tags")?.toString() ?? "";

  if (country.length > 255) {
    return { error: t("countryTooLong") };
  }

  if (!title || !figureName) {
    return { error: t("titleFigureRequired") };
  }

  const newSlug = slugRaw
    ? slugify(slugRaw)
    : defaultBookSlug(figureName, title);
  if (!newSlug) {
    return { error: t("slugDerive") };
  }
  if (isReservedSlug(newSlug)) {
    return { error: t("slugReserved") };
  }
  if (!intendedAges) {
    return { error: t("intendedAgesRequired") };
  }
  if (
    !isKnownIntendedAudience(intendedAges) &&
    intendedAges !== book.intendedAges.trim()
  ) {
    return { error: t("intendedAgesInvalid") };
  }

  if (figureName !== book.figureName.trim()) {
    const pickErr = await requireVerifiedFigurePick(
      figureName,
      formData.get("figureVerifiedKind")?.toString() ?? null,
      formData.get("figureVerifiedKey")?.toString() ?? null,
    );
    if (pickErr) return pickErr;
  }

  const taken = await prisma.book.findFirst({
    where: { slug: newSlug, id: { not: book.id } },
  });
  if (taken) {
    return { error: t("anotherSlug") };
  }

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  const tags = parseTags(tagsRaw);

  const defaultLocaleRaw =
    formData.get("defaultLocale")?.toString().trim() || "";
  const allowedLocales = new Set(book.languages.map((l) => l.locale));
  if (!defaultLocaleRaw || !allowedLocales.has(defaultLocaleRaw)) {
    return { error: t("primaryLanguageFromBook") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: book.id },
        data: {
          slug: newSlug,
          title,
          figureName,
          intendedAges,
          country,
          summary,
          defaultLocale: defaultLocaleRaw,
        },
      });

      await tx.bookLocalization.upsert({
        where: {
          bookId_locale: { bookId: book.id, locale: defaultLocaleRaw },
        },
        create: {
          bookId: book.id,
          locale: defaultLocaleRaw,
          title,
        },
        update: { title },
      });

      await tx.bookTag.deleteMany({ where: { bookId: book.id } });
      for (const t of tags) {
        const tag = await tx.tag.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, name: t.name },
          update: { name: t.name },
        });
        await tx.bookTag.create({
          data: { bookId: book.id, tagId: tag.id },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : t("couldNotUpdateBook");
    if (msg.includes("Unique constraint")) {
      return { error: t("slugInUse") };
    }
    return { error: msg };
  }

  revalidatePathLocalized("/");
  revalidatePathLocalized(`/books/${currentSlug}`, "layout");
  revalidatePathLocalized(`/books/${newSlug}`, "layout");
  if (book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  const uiLocale = await getLocale();
  redirect(`/${uiLocale}/books/${newSlug}`);
  return {};
}

export type AddBookLanguageResult = { error: string } | { ok: true };

/** Adds a language to the book (no section data). Editors translate on the language page. */
export async function addBookLanguage(
  bookSlug: string,
  locale: string,
): Promise<AddBookLanguageResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const loc = locale.trim();
  if (!isKnownBookLocale(loc)) {
    return { error: t("languageUnsupported") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      isDraft: true,
      createdById: true,
      languages: { select: { locale: true } },
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }
  if (book.languages.some((l) => l.locale === loc)) {
    return { error: t("languageAlreadyOnBook") };
  }

  try {
    await prisma.bookLanguage.create({
      data: { bookId: book.id, locale: loc },
    });
  } catch {
    return { error: t("addLanguageFailed") };
  }

  revalidatePathLocalized("/");
  revalidatePathLocalized(`/books/${bookSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}`, "layout");
  revalidatePathLocalized(`/books/${bookSlug}/edit`);
  if (book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  return { ok: true };
}

export type AddSectionState = { error?: string };

export async function addSectionToBook(
  bookSlug: string,
  _prev: AddSectionState,
  formData: FormData,
): Promise<AddSectionState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const title = formData.get("title")?.toString().trim() ?? "";
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);

  if (!title || !slug) {
    return { error: t("sectionTitleRequired") };
  }
  if (isReservedSlug(slug)) {
    return { error: t("sectionSlugReserved") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      defaultLocale: true,
      isDraft: true,
      createdById: true,
      sections: {
        orderBy: { orderIndex: "desc" },
        take: 1,
        select: { orderIndex: true },
      },
    },
  });
  if (!book) return { error: t("bookNotFound") };
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }

  const nextOrder = (book.sections[0]?.orderIndex ?? -1) + 1;
  const loc = book.defaultLocale;

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug,
          orderIndex: nextOrder,
          localizations: {
            create: { locale: loc, title },
          },
        },
      });
      const rev = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: session.user!.id,
          locale: loc,
          body: `## ${title}\n\n_Add content for this section._`,
          summaryComment: "New section",
        },
      });
      await awardReputationTx(tx, session.user!.id, "SECTION_ADDED", {
        refBookId: book.id,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      return await notifyBookActivityTx(tx, {
        bookId: book.id,
        actorId: session.user!.id,
        type: "NEW_SECTION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes("Unique constraint")
    ) {
      return { error: t("sectionExists") };
    }
    return { error: t("addSectionFailed") };
  }

  revalidatePathLocalized(`/books/${bookSlug}`);
  if (book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${bookSlug}/${slug}/edit`, loc)}`,
  );
  return {};
}

/**
 * Sets section order for a book. `orderedSectionIds` must be a permutation of that
 * book’s section ids (same length, no extras).
 */
export async function reorderBookSections(
  bookSlug: string,
  orderedSectionIds: string[],
): Promise<{ error?: string }> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      isDraft: true,
      createdById: true,
      sections: { select: { id: true } },
    },
  });
  if (!book) return { error: t("bookNotFound") };
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }

  const validIds = new Set(book.sections.map((s) => s.id));
  if (orderedSectionIds.length !== validIds.size) {
    return { error: t("sectionOrderMismatch") };
  }
  const seen = new Set<string>();
  for (const id of orderedSectionIds) {
    if (!validIds.has(id) || seen.has(id)) {
      return { error: t("invalidSectionOrder") };
    }
    seen.add(id);
  }

  await prisma.$transaction(
    orderedSectionIds.map((id, orderIndex) =>
      prisma.section.update({
        where: { id },
        data: { orderIndex },
      }),
    ),
  );

  revalidatePathLocalized(`/books/${bookSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/edit/contents`);
  if (book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  return {};
}

export async function updateBookLocalizedTitle(
  bookSlug: string,
  locale: string,
  newTitle: string,
): Promise<{ error?: string }> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const title = newTitle.trim();
  if (!title) {
    return { error: t("titleRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      defaultLocale: true,
      isDraft: true,
      createdById: true,
      languages: { select: { locale: true } },
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }
  const allowed = book.languages.map((l) => l.locale);
  if (!allowed.includes(locale)) {
    return { error: t("invalidBookLanguage") };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookLocalization.upsert({
      where: { bookId_locale: { bookId: book.id, locale } },
      create: { bookId: book.id, locale, title },
      update: { title },
    });
    if (locale === book.defaultLocale) {
      await tx.book.update({
        where: { id: book.id },
        data: { title },
      });
    }
  });

  revalidatePathLocalized(`/books/${bookSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/edit`);
  revalidatePathLocalized(
    `/books/${bookSlug}/edit/languages/${encodeURIComponent(locale)}`,
  );
  revalidatePathLocalized(`/books/${bookSlug}/edit/contents`);
  revalidatePathLocalized(`/books/${bookSlug}`, "layout");
  return {};
}

const MAX_SECTION_TITLE_LEN = 255;

export async function updateSectionTitle(
  bookSlug: string,
  sectionSlug: string,
  locale: string,
  newTitle: string,
): Promise<{ error?: string }> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const title = newTitle.trim();
  if (!title) {
    return { error: t("titleRequired") };
  }
  if (title.length > MAX_SECTION_TITLE_LEN) {
    return {
      error: t("titleMaxLength", { max: MAX_SECTION_TITLE_LEN }),
    };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: {
        select: {
          isDraft: true,
          createdById: true,
          languages: { select: { locale: true } },
        },
      },
    },
  });
  if (!section) {
    return { error: t("sectionNotFound") };
  }
  if (
    !userMayEditDraftBook(
      section.book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }
  const allowed = section.book.languages.map((l) => l.locale);
  if (!allowed.includes(locale)) {
    return { error: t("invalidBookLanguage") };
  }

  await prisma.sectionLocalization.upsert({
    where: {
      sectionId_locale: { sectionId: section.id, locale },
    },
    create: { sectionId: section.id, locale, title },
    update: { title },
  });

  revalidatePathLocalized(`/books/${bookSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/edit/contents`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/history`);
  return {};
}

export type SaveRevisionState = { error?: string };

/**
 * Readers require a non-empty SectionLocalization title for the locale. When
 * publishing a body in a language that has no title row yet, seed the title
 * from the same fallback chain as the editor (primary locale → first title → slug).
 */
async function ensureSectionTitleRowForPublishedBody(
  tx: Prisma.TransactionClient,
  section: { id: string; slug: string },
  locale: string,
  defaultLocale: string,
): Promise<void> {
  const locs = await tx.sectionLocalization.findMany({
    where: { sectionId: section.id },
    select: { locale: true, title: true },
  });
  if (locs.find((l) => l.locale === locale)?.title?.trim()) {
    return;
  }
  const seedTitle = resolveSectionTitle(
    section.slug,
    locs,
    locale,
    defaultLocale,
  );
  await tx.sectionLocalization.upsert({
    where: {
      sectionId_locale: { sectionId: section.id, locale },
    },
    create: {
      sectionId: section.id,
      locale,
      title: seedTitle,
    },
    update: { title: seedTitle },
  });
}

export async function saveSectionRevision(
  bookSlug: string,
  sectionSlug: string,
  _prev: SaveRevisionState,
  formData: FormData,
): Promise<SaveRevisionState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const body = formData.get("body")?.toString() ?? "";
  const summaryComment = formData.get("summaryComment")?.toString().trim() || null;
  const localeRaw = formData.get("locale")?.toString() ?? "";

  if (!body.trim()) {
    return { error: t("contentEmpty") };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: {
        select: {
          defaultLocale: true,
          isDraft: true,
          languages: { select: { locale: true } },
        },
      },
    },
  });
  if (!section) {
    return { error: t("sectionNotFound") };
  }
  const allowed = section.book.languages.map((l) => l.locale);
  const locale = normalizeActiveLocale(
    localeRaw,
    allowed,
    section.book.defaultLocale,
  );

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const latest = await getLatestRevision(section.id, locale, tx);
      const rev = await createRevision(
        {
          sectionId: section.id,
          authorId: session.user.id,
          locale,
          body,
          summaryComment,
          parentRevisionId: latest?.id ?? null,
        },
        tx,
      );
      await ensureSectionTitleRowForPublishedBody(
        tx,
        section,
        locale,
        section.book.defaultLocale,
      );
      await awardReputationTx(tx, session.user.id, "REVISION_SAVED", {
        refBookId: section.bookId,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      return await notifyBookActivityTx(tx, {
        bookId: section.bookId,
        actorId: session.user.id,
        type: "NEW_REVISION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("saveFailed") };
  }

  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePathLocalized(`/books/${bookSlug}`);
  if (section.book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${bookSlug}/${sectionSlug}`, locale)}`,
  );
  return {};
}

export type SaveSectionRevisionInlineResult =
  | { ok: true }
  | { error: string };

export async function saveSectionRevisionInline(
  bookSlug: string,
  sectionSlug: string,
  locale: string,
  body: string,
  summaryComment: string | null = null,
): Promise<SaveSectionRevisionInlineResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  if (!body.trim()) {
    return { error: t("contentEmpty") };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: {
        select: {
          createdById: true,
          defaultLocale: true,
          isDraft: true,
          languages: { select: { locale: true } },
        },
      },
    },
  });
  if (!section) {
    return { error: t("sectionNotFound") };
  }
  if (section.book.createdById !== session.user.id) {
    return { error: t("onlyCreatorWizard") };
  }
  const allowed = section.book.languages.map((l) => l.locale);
  const loc = normalizeActiveLocale(
    locale,
    allowed,
    section.book.defaultLocale,
  );

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  try {
    const emailIds = await prisma.$transaction(async (tx) => {
      const latest = await getLatestRevision(section.id, loc, tx);
      const rev = await createRevision(
        {
          sectionId: section.id,
          authorId: session.user.id,
          locale: loc,
          body,
          summaryComment,
          parentRevisionId: latest?.id ?? null,
        },
        tx,
      );
      await ensureSectionTitleRowForPublishedBody(
        tx,
        section,
        loc,
        section.book.defaultLocale,
      );
      await awardReputationTx(tx, session.user.id, "REVISION_SAVED", {
        refBookId: section.bookId,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      return await notifyBookActivityTx(tx, {
        bookId: section.bookId,
        actorId: session.user.id,
        type: "NEW_REVISION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
    await dispatchNotificationEmails(emailIds);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("saveFailed") };
  }

  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePathLocalized(`/books/${bookSlug}`);
  if (section.book.isDraft) {
    revalidatePathLocalized("/drafts");
  }
  return { ok: true };
}

export type BookSectionLatestForWizard = {
  slug: string;
  title: string;
  orderIndex: number;
  body: string;
};

export type GetBookSectionsLatestForWizardResult =
  | { error: string }
  | { sections: BookSectionLatestForWizard[] };

export async function getBookSectionsLatestForWizard(
  bookSlug: string,
  locale: string,
): Promise<GetBookSectionsLatestForWizardResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      createdById: true,
      defaultLocale: true,
      languages: { select: { locale: true } },
    },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (book.createdById !== session.user.id) {
    return { error: t("onlyCreatorLoadWizard") };
  }
  const allowed = book.languages.map((l) => l.locale);
  const loc = normalizeActiveLocale(locale, allowed, book.defaultLocale);

  const sections = await prisma.section.findMany({
    where: { bookId: book.id },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      slug: true,
      orderIndex: true,
      localizations: { select: { locale: true, title: true } },
    },
  });

  const sectionsWithBody: BookSectionLatestForWizard[] = [];
  for (const s of sections) {
    const latest = await getLatestRevision(s.id, loc);
    const title = resolveSectionTitle(
      s.slug,
      s.localizations,
      loc,
      book.defaultLocale,
    );
    sectionsWithBody.push({
      slug: s.slug,
      title,
      orderIndex: s.orderIndex,
      body: latest?.body ?? "",
    });
  }

  return { sections: sectionsWithBody };
}

export type WizardChapterBudgetResult = { ok: true } | { error: string };

/**
 * Ensures saving one new revision per section would not exceed the hourly revision cap.
 */
export async function assertWizardChapterRevisionBudget(
  bookSlug: string,
): Promise<WizardChapterBudgetResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: { id: true, createdById: true },
  });
  if (!book) {
    return { error: t("bookNotFound") };
  }
  if (book.createdById !== session.user.id) {
    return { error: t("onlyCreatorRunWizard") };
  }

  const n = await prisma.section.count({ where: { bookId: book.id } });
  try {
    await assertRevisionBudget(session.user.id, n);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  return { ok: true };
}

export async function revertSectionRevision(
  bookSlug: string,
  sectionSlug: string,
  revisionId: string,
  locale: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: {
      book: {
        select: {
          defaultLocale: true,
          languages: { select: { locale: true } },
        },
      },
    },
  });
  if (!section) throw new Error("Section not found");
  const allowed = section.book.languages.map((l) => l.locale);
  const loc = normalizeActiveLocale(
    locale,
    allowed,
    section.book.defaultLocale,
  );

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    throw e instanceof Error ? e : new Error("Rate limited");
  }

  const emailIds = await prisma.$transaction(async (tx) => {
    const rev = await revertToRevision(
      {
        sectionId: section.id,
        locale: loc,
        authorId: session.user.id,
        targetRevisionId: revisionId,
      },
      tx,
    );
    await awardReputationTx(tx, session.user.id, "REVERT", {
      refBookId: section.bookId,
      refSectionId: section.id,
      refRevisionId: rev.id,
    });
    return await notifyBookActivityTx(tx, {
      bookId: section.bookId,
      actorId: session.user.id,
      type: "REVERT",
      sectionId: section.id,
      revisionId: rev.id,
    });
  });
  await dispatchNotificationEmails(emailIds);

  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePathLocalized(`/books/${bookSlug}`);
  const uiLocale = await getLocale();
  redirect(
    `/${uiLocale}${withLangQuery(`/books/${bookSlug}/${sectionSlug}`, loc)}`,
  );
  return {};
}

export async function revertSectionFromForm(formData: FormData) {
  const bookSlug = formData.get("bookSlug")?.toString() ?? "";
  const sectionSlug = formData.get("sectionSlug")?.toString() ?? "";
  const revisionId = formData.get("revisionId")?.toString() ?? "";
  const locale = formData.get("locale")?.toString() ?? "";
  if (!bookSlug || !sectionSlug || !revisionId) {
    throw new Error("Missing fields");
  }
  await revertSectionRevision(bookSlug, sectionSlug, revisionId, locale);
}

export type AddTocFromLlmResult = {
  error?: string;
  added?: number;
  skipped?: number;
};

/**
 * Creates multiple sections from client-parsed LLM output (e.g. local WebLLM).
 */
export async function addTocSectionsFromLlm(
  bookSlug: string,
  itemsJson: string,
): Promise<AddTocFromLlmResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  let items: unknown;
  try {
    items = JSON.parse(itemsJson) as unknown;
  } catch {
    return { error: t("invalidData") };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: t("noSectionsToAdd") };
  }
  if (items.length > MAX_LLM_TOC_SECTIONS) {
    return {
      error: t("maxTocSections", { max: MAX_LLM_TOC_SECTIONS }),
    };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: { sections: true },
  });
  if (!book) return { error: t("bookNotFound") };

  type Row = { title: string; slug: string };
  const normalized: Row[] = [];
  const seenNew = new Set<string>();

  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title =
      typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const preferredSlug =
      typeof r.slug === "string" ? r.slug.trim() : undefined;
    const taken = new Set<string>([
      ...book.sections.map((s) => s.slug),
      ...seenNew,
    ]);
    const slug = uniqueSlugFromPreferred(preferredSlug, title, taken);
    if (!slug) continue;
    seenNew.add(slug);
    normalized.push({ title, slug });
  }

  if (normalized.length === 0) {
    return { error: t("noValidNewSections") };
  }

  try {
    await assertRevisionBudget(session.user.id, normalized.length);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("rateLimited") };
  }

  const maxOrder = book.sections.reduce(
    (m, s) => Math.max(m, s.orderIndex),
    -1,
  );

  let added = 0;
  const skipped = items.length - normalized.length;

  const defLoc = book.defaultLocale;

  const emailIds = await prisma.$transaction(async (tx) => {
    let order = maxOrder;
    for (const row of normalized) {
      order += 1;
      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug: row.slug,
          orderIndex: order,
          localizations: {
            create: { locale: defLoc, title: row.title },
          },
        },
      });
      const body = `## ${row.title}\n\n_Outline from local AI — add narrative here._`;
      const rev = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: session.user!.id,
          locale: defLoc,
          body,
          summaryComment: "Section from local LLM TOC",
        },
      });
      await awardReputationTx(tx, session.user!.id, "SECTION_ADDED", {
        refBookId: book.id,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      added += 1;
    }
    if (added > 0) {
      return await notifyBookActivityTx(tx, {
        bookId: book.id,
        actorId: session.user!.id,
        type: "NEW_SECTION",
        sectionId: null,
        revisionId: null,
      });
    }
    return [] as string[];
  });
  await dispatchNotificationEmails(emailIds);

  revalidatePathLocalized(`/books/${bookSlug}`);
  return { added, skipped };
}

export type DeleteSectionState = { error?: string };

export async function deleteSectionFromBook(
  bookSlug: string,
  sectionSlug: string,
  _prev: DeleteSectionState,
  _formData: FormData,
): Promise<DeleteSectionState> {
  void _prev;
  void _formData;
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: {
      id: true,
      isDraft: true,
      createdById: true,
      sections: { select: { id: true, slug: true } },
    },
  });
  if (!book) return { error: t("bookNotFound") };
  if (
    !userMayEditDraftBook(
      book,
      session.user.id,
      Boolean(session.user.isAdmin),
    )
  ) {
    return { error: t("onlyCreatorWizard") };
  }
  if (book.sections.length <= 1) {
    return { error: t("cannotDeleteOnlySection") };
  }

  const target = book.sections.find((s) => s.slug === sectionSlug);
  if (!target) return { error: t("sectionNotFound") };

  await prisma.section.delete({ where: { id: target.id } });

  revalidatePathLocalized(`/books/${bookSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePathLocalized(`/books/${bookSlug}/${sectionSlug}/history`);
  if (book.isDraft) {
    revalidatePathLocalized("/drafts");
  }

  const uiLocale = await getLocale();
  redirect(`/${uiLocale}/books/${bookSlug}`);
  return {};
}

export type DeleteBookAdminState = { error?: string };

/**
 * Permanently deletes a book and all related sections/revisions (cascade).
 * Only users with `User.isAdmin` may call this.
 */
export async function deleteBookAsAdmin(
  _prev: DeleteBookAdminState,
  formData: FormData,
): Promise<DeleteBookAdminState> {
  void _prev;
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }
  if (!session.user.isAdmin) {
    return { error: t("onlyAdminDelete") };
  }

  const bookSlug = formData.get("bookSlug")?.toString().trim() ?? "";
  if (!bookSlug) {
    return { error: t("missingBook") };
  }

  const book = await prisma.book.findUnique({ where: { slug: bookSlug } });
  if (!book) {
    return { error: t("bookNotFound") };
  }

  const typedTitle = formData.get("confirmTitle")?.toString().trim() ?? "";
  if (typedTitle !== book.title.trim()) {
    return { error: t("deleteTitleMismatch") };
  }

  await prisma.book.delete({ where: { id: book.id } });

  revalidatePathLocalized("/");
  revalidatePathLocalized(`/books/${bookSlug}`, "layout");
  const uiLocale = await getLocale();
  redirect(`/${uiLocale}`);
  return {};
}
