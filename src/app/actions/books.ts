"use server";

import { revalidatePath } from "next/cache";
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
import { notifyBookActivityTx, notifyNewBookDigestTx } from "@/lib/notifications";
import { awardReputationTx } from "@/lib/reputation";
import { assertFigurePickInSearchResults } from "@/lib/figure-candidates";
import { isKnownIntendedAudience } from "@/lib/intended-audience";
import { MAX_LLM_TOC_SECTIONS } from "@/lib/book-limits";
import { isReservedSlug, uniqueSlugFromPreferred, slugify } from "@/lib/slug";

const FIGURE_PICK_ERROR =
  'Use “Check name”, choose a matching person, then “Use selected person” — or restore the original figure name when editing.';

async function requireVerifiedFigurePick(
  figureName: string,
  kindRaw: string | null,
  keyRaw: string | null,
): Promise<BookFormState | null> {
  const kind = kindRaw?.trim() ?? "";
  const key = keyRaw?.trim() ?? "";
  if (kind !== "wikipedia" && kind !== "wikidata") {
    return { error: FIGURE_PICK_ERROR };
  }
  const ok = await assertFigurePickInSearchResults(
    figureName,
    kind as "wikipedia" | "wikidata",
    key,
  );
  if (!ok) {
    return {
      error:
        "Figure choice no longer matches catalog search. Run Check name again and pick again.",
    };
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
};

async function validateCreateBookForm(
  formData: FormData,
): Promise<BookFormState | ValidatedCreateBook> {
  const title = formData.get("title")?.toString().trim() ?? "";
  const figureName = formData.get("figureName")?.toString().trim() ?? "";
  const intendedAges = formData.get("intendedAges")?.toString().trim() ?? "";
  const country = formData.get("country")?.toString().trim() ?? "";
  const summary = formData.get("summary")?.toString().trim() || null;
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const tagsRaw = formData.get("tags")?.toString() ?? "";

  if (country.length > 255) {
    return { error: "Country / region must be 255 characters or fewer." };
  }

  const slug = slugRaw ? slugify(slugRaw) : slugify(figureName || title);
  if (!slug) {
    return { error: "Provide a figure name or URL slug." };
  }
  if (isReservedSlug(slug)) {
    return { error: "That URL slug is reserved. Choose another." };
  }
  if (!title || !figureName) {
    return { error: "Title and historical figure name are required." };
  }
  if (!intendedAges) {
    return {
      error:
        "Intended ages or audience is required (who should be able to read this book?).",
    };
  }
  if (!isKnownIntendedAudience(intendedAges)) {
    return { error: "Choose a valid age / audience from the list." };
  }

  const pickErr = await requireVerifiedFigurePick(
    figureName,
    formData.get("figureVerifiedKind")?.toString() ?? null,
    formData.get("figureVerifiedKey")?.toString() ?? null,
  );
  if (pickErr) return pickErr;

  const tags = parseTags(tagsRaw);
  return {
    slug,
    title,
    figureName,
    intendedAges,
    country,
    summary,
    tags,
  };
}

function isValidatedCreateBook(
  v: BookFormState | ValidatedCreateBook,
): v is ValidatedCreateBook {
  return "slug" in v && typeof (v as ValidatedCreateBook).slug === "string";
}

async function insertNewBook(
  userId: string,
  v: ValidatedCreateBook,
): Promise<BookFormState> {
  try {
    await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          slug: v.slug,
          title: v.title,
          figureName: v.figureName,
          intendedAges: v.intendedAges,
          country: v.country,
          summary: v.summary,
          createdById: userId,
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

      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug: "introduction",
          title: "Introduction",
          orderIndex: 0,
        },
      });

      const introRevision = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: userId,
          body:
            "This book has just been created. **Edit this introduction** to begin the biography.",
          summaryComment: "Initial revision",
        },
      });

      await awardReputationTx(tx, userId, "BOOK_CREATED", {
        refBookId: book.id,
        refSectionId: section.id,
        refRevisionId: introRevision.id,
      });
      await notifyNewBookDigestTx(tx, book.id, userId);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create book.";
    if (msg.includes("Unique constraint")) {
      return { error: "A book with this URL slug already exists." };
    }
    return { error: msg };
  }

  return {};
}

export async function createBook(
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const validated = await validateCreateBookForm(formData);
  if (!isValidatedCreateBook(validated)) {
    return validated;
  }

  try {
    await assertCanCreateBook(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  const err = await insertNewBook(session.user.id, validated);
  if (err.error) return err;

  revalidatePath("/");
  redirect(`/books/${validated.slug}`);
}

export type CreateBookForWizardResult =
  | { ok: true; slug: string }
  | { error: string };

/**
 * Same as createBook but returns the slug for client-driven flows (no redirect).
 */
export async function createBookForWizard(
  formData: FormData,
): Promise<CreateBookForWizardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const validated = await validateCreateBookForm(formData);
  if (!isValidatedCreateBook(validated)) {
    return { error: validated.error ?? "Invalid form." };
  }

  try {
    await assertCanCreateBook(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  const err = await insertNewBook(session.user.id, validated);
  if (err.error) {
    return { error: err.error };
  }

  revalidatePath("/");
  revalidatePath(`/books/${validated.slug}`);
  return { ok: true, slug: validated.slug };
}

/**
 * Update book metadata and tags. `currentSlug` is the book’s slug when the form was loaded.
 */
export async function updateBook(
  currentSlug: string,
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: currentSlug },
  });
  if (!book) {
    return { error: "Book not found." };
  }

  const title = formData.get("title")?.toString().trim() ?? "";
  const figureName = formData.get("figureName")?.toString().trim() ?? "";
  const intendedAges = formData.get("intendedAges")?.toString().trim() ?? "";
  const country = formData.get("country")?.toString().trim() ?? "";
  const summary = formData.get("summary")?.toString().trim() || null;
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const tagsRaw = formData.get("tags")?.toString() ?? "";

  if (country.length > 255) {
    return { error: "Country / region must be 255 characters or fewer." };
  }

  const newSlug = slugRaw ? slugify(slugRaw) : slugify(figureName || title);
  if (!newSlug) {
    return { error: "Provide a figure name or URL slug." };
  }
  if (isReservedSlug(newSlug)) {
    return { error: "That URL slug is reserved. Choose another." };
  }
  if (!title || !figureName) {
    return { error: "Title and historical figure name are required." };
  }
  if (!intendedAges) {
    return {
      error:
        "Intended ages or audience is required (who should be able to read this book?).",
    };
  }
  if (
    !isKnownIntendedAudience(intendedAges) &&
    intendedAges !== book.intendedAges.trim()
  ) {
    return { error: "Choose a valid age / audience from the list." };
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
    return { error: "Another book already uses this URL slug." };
  }

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  const tags = parseTags(tagsRaw);

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
        },
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
    const msg = e instanceof Error ? e.message : "Could not update book.";
    if (msg.includes("Unique constraint")) {
      return { error: "That URL slug is already in use." };
    }
    return { error: msg };
  }

  revalidatePath("/");
  revalidatePath(`/books/${currentSlug}`, "layout");
  revalidatePath(`/books/${newSlug}`, "layout");
  redirect(`/books/${newSlug}`);
}

export type AddSectionState = { error?: string };

export async function addSectionToBook(
  bookSlug: string,
  _prev: AddSectionState,
  formData: FormData,
): Promise<AddSectionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const title = formData.get("title")?.toString().trim() ?? "";
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);

  if (!title || !slug) {
    return { error: "Section title is required." };
  }
  if (isReservedSlug(slug)) {
    return { error: "That URL slug is reserved." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      sections: { orderBy: { orderIndex: "desc" }, take: 1 },
    },
  });
  if (!book) return { error: "Book not found." };

  const nextOrder = (book.sections[0]?.orderIndex ?? -1) + 1;

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug,
          title,
          orderIndex: nextOrder,
        },
      });
      const rev = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: session.user!.id,
          body: `## ${title}\n\n_Add content for this section._`,
          summaryComment: "New section",
        },
      });
      await awardReputationTx(tx, session.user!.id, "SECTION_ADDED", {
        refBookId: book.id,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      await notifyBookActivityTx(tx, {
        bookId: book.id,
        actorId: session.user!.id,
        type: "NEW_SECTION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes("Unique constraint")
    ) {
      return { error: "A section with this URL slug already exists in this book." };
    }
    return { error: "Could not add section." };
  }

  revalidatePath(`/books/${bookSlug}`);
  redirect(`/books/${bookSlug}/${slug}/edit`);
}

/**
 * Sets section order for a book. `orderedSectionIds` must be a permutation of that
 * book’s section ids (same length, no extras).
 */
export async function reorderBookSections(
  bookSlug: string,
  orderedSectionIds: string[],
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: { sections: { select: { id: true } } },
  });
  if (!book) return { error: "Book not found." };

  const validIds = new Set(book.sections.map((s) => s.id));
  if (orderedSectionIds.length !== validIds.size) {
    return { error: "Section list does not match this book." };
  }
  const seen = new Set<string>();
  for (const id of orderedSectionIds) {
    if (!validIds.has(id) || seen.has(id)) {
      return { error: "Invalid or duplicate section in order." };
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

  revalidatePath(`/books/${bookSlug}`);
  revalidatePath(`/books/${bookSlug}/edit/contents`);
  return {};
}

const MAX_SECTION_TITLE_LEN = 255;

export async function updateSectionTitle(
  bookSlug: string,
  sectionSlug: string,
  newTitle: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const title = newTitle.trim();
  if (!title) {
    return { error: "Title is required." };
  }
  if (title.length > MAX_SECTION_TITLE_LEN) {
    return {
      error: `Title must be at most ${MAX_SECTION_TITLE_LEN} characters.`,
    };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
  });
  if (!section) {
    return { error: "Section not found." };
  }

  await prisma.section.update({
    where: { id: section.id },
    data: { title },
  });

  revalidatePath(`/books/${bookSlug}`);
  revalidatePath(`/books/${bookSlug}/edit/contents`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/history`);
  return {};
}

export type SaveRevisionState = { error?: string };

export async function saveSectionRevision(
  bookSlug: string,
  sectionSlug: string,
  _prev: SaveRevisionState,
  formData: FormData,
): Promise<SaveRevisionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const body = formData.get("body")?.toString() ?? "";
  const summaryComment = formData.get("summaryComment")?.toString().trim() || null;

  if (!body.trim()) {
    return { error: "Content cannot be empty." };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
  });
  if (!section) {
    return { error: "Section not found." };
  }

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await getLatestRevision(section.id, tx);
      const rev = await createRevision(
        {
          sectionId: section.id,
          authorId: session.user.id,
          body,
          summaryComment,
          parentRevisionId: latest?.id ?? null,
        },
        tx,
      );
      await awardReputationTx(tx, session.user.id, "REVISION_SAVED", {
        refBookId: section.bookId,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      await notifyBookActivityTx(tx, {
        bookId: section.bookId,
        actorId: session.user.id,
        type: "NEW_REVISION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed." };
  }

  revalidatePath(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePath(`/books/${bookSlug}`);
  redirect(`/books/${bookSlug}/${sectionSlug}`);
}

export type SaveSectionRevisionInlineResult =
  | { ok: true }
  | { error: string };

export async function saveSectionRevisionInline(
  bookSlug: string,
  sectionSlug: string,
  body: string,
  summaryComment: string | null = null,
): Promise<SaveSectionRevisionInlineResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  if (!body.trim()) {
    return { error: "Content cannot be empty." };
  }

  const section = await prisma.section.findFirst({
    where: {
      slug: sectionSlug,
      book: { slug: bookSlug },
    },
    include: { book: { select: { createdById: true } } },
  });
  if (!section) {
    return { error: "Section not found." };
  }
  if (section.book.createdById !== session.user.id) {
    return { error: "Only the book creator can use the auto wizard on this book." };
  }

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await getLatestRevision(section.id, tx);
      const rev = await createRevision(
        {
          sectionId: section.id,
          authorId: session.user.id,
          body,
          summaryComment,
          parentRevisionId: latest?.id ?? null,
        },
        tx,
      );
      await awardReputationTx(tx, session.user.id, "REVISION_SAVED", {
        refBookId: section.bookId,
        refSectionId: section.id,
        refRevisionId: rev.id,
      });
      await notifyBookActivityTx(tx, {
        bookId: section.bookId,
        actorId: session.user.id,
        type: "NEW_REVISION",
        sectionId: section.id,
        revisionId: rev.id,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed." };
  }

  revalidatePath(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePath(`/books/${bookSlug}`);
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
): Promise<GetBookSectionsLatestForWizardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: { id: true, createdById: true },
  });
  if (!book) {
    return { error: "Book not found." };
  }
  if (book.createdById !== session.user.id) {
    return { error: "Only the book creator can load wizard data for this book." };
  }

  const sections = await prisma.section.findMany({
    where: { bookId: book.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, slug: true, title: true, orderIndex: true },
  });

  const sectionsWithBody: BookSectionLatestForWizard[] = [];
  for (const s of sections) {
    const latest = await getLatestRevision(s.id);
    sectionsWithBody.push({
      slug: s.slug,
      title: s.title,
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
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    select: { id: true, createdById: true },
  });
  if (!book) {
    return { error: "Book not found." };
  }
  if (book.createdById !== session.user.id) {
    return { error: "Only the book creator can run the wizard on this book." };
  }

  const n = await prisma.section.count({ where: { bookId: book.id } });
  try {
    await assertRevisionBudget(session.user.id, n);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  return { ok: true };
}

export async function revertSectionRevision(
  bookSlug: string,
  sectionSlug: string,
  revisionId: string,
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
  });
  if (!section) throw new Error("Section not found");

  try {
    await assertCanCreateRevision(session.user.id);
  } catch (e) {
    throw e instanceof Error ? e : new Error("Rate limited");
  }

  await prisma.$transaction(async (tx) => {
    const rev = await revertToRevision(
      {
        sectionId: section.id,
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
    await notifyBookActivityTx(tx, {
      bookId: section.bookId,
      actorId: session.user.id,
      type: "REVERT",
      sectionId: section.id,
      revisionId: rev.id,
    });
  });

  revalidatePath(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/history`);
  revalidatePath(`/books/${bookSlug}`);
  redirect(`/books/${bookSlug}/${sectionSlug}`);
}

export async function revertSectionFromForm(formData: FormData) {
  const bookSlug = formData.get("bookSlug")?.toString() ?? "";
  const sectionSlug = formData.get("sectionSlug")?.toString() ?? "";
  const revisionId = formData.get("revisionId")?.toString() ?? "";
  if (!bookSlug || !sectionSlug || !revisionId) {
    throw new Error("Missing fields");
  }
  await revertSectionRevision(bookSlug, sectionSlug, revisionId);
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
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  let items: unknown;
  try {
    items = JSON.parse(itemsJson) as unknown;
  } catch {
    return { error: "Invalid data." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "No sections to add." };
  }
  if (items.length > MAX_LLM_TOC_SECTIONS) {
    return { error: `At most ${MAX_LLM_TOC_SECTIONS} sections per request.` };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: { sections: true },
  });
  if (!book) return { error: "Book not found." };

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
    return {
      error:
        "No valid new sections (duplicates, reserved slugs, or empty titles were skipped).",
    };
  }

  try {
    await assertRevisionBudget(session.user.id, normalized.length);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rate limited." };
  }

  const maxOrder = book.sections.reduce(
    (m, s) => Math.max(m, s.orderIndex),
    -1,
  );

  let added = 0;
  const skipped = items.length - normalized.length;

  await prisma.$transaction(async (tx) => {
    let order = maxOrder;
    for (const row of normalized) {
      order += 1;
      const section = await tx.section.create({
        data: {
          bookId: book.id,
          slug: row.slug,
          title: row.title,
          orderIndex: order,
        },
      });
      const body = `## ${row.title}\n\n_Outline from local AI — add narrative here._`;
      const rev = await tx.revision.create({
        data: {
          sectionId: section.id,
          authorId: session.user!.id,
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
      await notifyBookActivityTx(tx, {
        bookId: book.id,
        actorId: session.user!.id,
        type: "NEW_SECTION",
        sectionId: null,
        revisionId: null,
      });
    }
  });

  revalidatePath(`/books/${bookSlug}`);
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
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const book = await prisma.book.findUnique({
    where: { slug: bookSlug },
    include: { sections: { select: { id: true, slug: true } } },
  });
  if (!book) return { error: "Book not found." };
  if (book.sections.length <= 1) {
    return {
      error:
        "You cannot delete the only section. Add another section first, then delete this one.",
    };
  }

  const target = book.sections.find((s) => s.slug === sectionSlug);
  if (!target) return { error: "Section not found." };

  await prisma.section.delete({ where: { id: target.id } });

  revalidatePath(`/books/${bookSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/edit`);
  revalidatePath(`/books/${bookSlug}/${sectionSlug}/history`);

  redirect(`/books/${bookSlug}`);
}
