import { MAX_AUTO_WIZARD_PUBLISH_SECTIONS } from "@/lib/book-limits";
import { isKnownBookLocale } from "@/lib/book-locales";
import { isKnownIntendedAudience } from "@/lib/intended-audience";
import { isReservedSlug, slugify } from "@/lib/slug";

export const BOOK_DRAFT_PAYLOAD_VERSION = 1 as const;
export const CHAPTER_DRAFT_PAYLOAD_VERSION = 1 as const;

export type BookDraftPayloadV1 = {
  v: typeof BOOK_DRAFT_PAYLOAD_VERSION;
  title: string;
  figureName: string;
  intendedAges: string;
  country: string;
  summary: string;
  /** Raw slug field (may be empty; derive on publish like create book). */
  slug: string;
  tags: string;
  defaultLocale: string;
  includeIntroduction: boolean;
  figureVerifiedKind: string;
  figureVerifiedKey: string;
  chapters: { slug: string; title: string; body: string }[] | null;
};

export type ChapterDraftPayloadV1 = {
  v: typeof CHAPTER_DRAFT_PAYLOAD_VERSION;
  targetBookSlug: string;
  sectionTitle: string;
  sectionSlug: string;
  body: string;
  locale: string;
  /** When set, publishing applies a new revision to this section instead of creating one. */
  existingSectionSlug?: string;
};

export function isBookDraftPayload(
  raw: unknown,
): raw is BookDraftPayloadV1 {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    o.v === BOOK_DRAFT_PAYLOAD_VERSION &&
    typeof o.title === "string" &&
    typeof o.figureName === "string"
  );
}

export function isChapterDraftPayload(
  raw: unknown,
): raw is ChapterDraftPayloadV1 {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    o.v === CHAPTER_DRAFT_PAYLOAD_VERSION &&
    typeof o.targetBookSlug === "string" &&
    typeof o.sectionTitle === "string"
  );
}

function parseChaptersJsonField(raw: string | null): {
  ok: true; chapters: { slug: string; title: string; body: string }[] | null;
} | { ok: false; errorKey: "invalidChapterJson" } {
  const s = raw?.trim() ?? "";
  if (!s) return { ok: true, chapters: null };
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, errorKey: "invalidChapterJson" };
    }
    const out: { slug: string; title: string; body: string }[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        return { ok: false, errorKey: "invalidChapterJson" };
      }
      const r = row as Record<string, unknown>;
      const title =
        typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
      const body = typeof r.body === "string" ? r.body : "";
      const slugRaw = typeof r.slug === "string" ? r.slug.trim() : "";
      const slug = slugify(slugRaw || title);
      if (!title || !slug) {
        return { ok: false, errorKey: "invalidChapterJson" };
      }
      out.push({ slug, title, body: body.trim() });
    }
    return { ok: true, chapters: out.length ? out : null };
  } catch {
    return { ok: false, errorKey: "invalidChapterJson" };
  }
}

export function bookFormDataToPayload(formData: FormData):
  | { ok: true; payload: BookDraftPayloadV1; label: string }
  | { ok: false; errorKey: "invalidChapterJson" } {
  const chaptersRaw = formData.get("chaptersJson")?.toString() ?? null;
  const parsed = parseChaptersJsonField(chaptersRaw);
  if (!parsed.ok) return parsed;

  const title = formData.get("title")?.toString().trim() ?? "";
  const figureName = formData.get("figureName")?.toString().trim() ?? "";
  const label = (title || figureName || "Untitled book draft").slice(0, 512);

  const payload: BookDraftPayloadV1 = {
    v: BOOK_DRAFT_PAYLOAD_VERSION,
    title: formData.get("title")?.toString() ?? "",
    figureName: formData.get("figureName")?.toString() ?? "",
    intendedAges: formData.get("intendedAges")?.toString().trim() ?? "",
    country: formData.get("country")?.toString().trim() ?? "",
    summary: formData.get("summary")?.toString() ?? "",
    slug: formData.get("slug")?.toString().trim() ?? "",
    tags: formData.get("tags")?.toString() ?? "",
    defaultLocale: formData.get("defaultLocale")?.toString().trim() ?? "",
    includeIntroduction:
      formData.get("includeIntroduction") === "on" ||
      formData.get("includeIntroduction") === "true",
    figureVerifiedKind:
      formData.get("figureVerifiedKind")?.toString().trim() ?? "",
    figureVerifiedKey:
      formData.get("figureVerifiedKey")?.toString().trim() ?? "",
    chapters: parsed.chapters,
  };
  return { ok: true, payload, label };
}

export function chapterFormDataToPayload(formData: FormData): {
  payload: ChapterDraftPayloadV1;
  label: string;
} {
  const sectionTitle = formData.get("sectionTitle")?.toString().trim() ?? "";
  const targetBookSlug =
    formData.get("targetBookSlug")?.toString().trim() ?? "";
  const label = (sectionTitle || targetBookSlug || "Chapter draft").slice(
    0,
    512,
  );
  const existingSectionSlug =
    formData.get("existingSectionSlug")?.toString().trim() ?? "";
  const payload: ChapterDraftPayloadV1 = {
    v: CHAPTER_DRAFT_PAYLOAD_VERSION,
    targetBookSlug,
    sectionTitle: formData.get("sectionTitle")?.toString() ?? "",
    sectionSlug: formData.get("sectionSlug")?.toString().trim() ?? "",
    body: formData.get("body")?.toString() ?? "",
    locale: formData.get("locale")?.toString().trim() ?? "",
    ...(existingSectionSlug
      ? { existingSectionSlug }
      : {}),
  };
  return { payload, label };
}

/** Build FormData for `validateCreateBookForm` / publish (full rules). */
export function bookPayloadToPublishFormData(p: BookDraftPayloadV1): FormData {
  const fd = new FormData();
  fd.set("title", p.title.trim());
  fd.set("figureName", p.figureName.trim());
  fd.set("intendedAges", p.intendedAges);
  fd.set("country", p.country);
  fd.set("summary", p.summary.trim());
  fd.set("slug", p.slug.trim());
  fd.set("tags", p.tags);
  fd.set("defaultLocale", p.defaultLocale);
  if (p.includeIntroduction) {
    fd.set("includeIntroduction", "on");
  }
  fd.set("figureVerifiedKind", p.figureVerifiedKind);
  fd.set("figureVerifiedKey", p.figureVerifiedKey);
  return fd;
}

export function bookPayloadChaptersToJson(
  p: BookDraftPayloadV1,
): string | null {
  if (!p.chapters?.length) return null;
  return JSON.stringify(p.chapters);
}

export type ParseBookDraftJsonForImportErrorKey =
  | "bookDraftImportInvalidJson"
  | "bookDraftImportInvalidPayload"
  | "invalidChapterJson"
  | "maxWizardSections"
  | "intendedAgesInvalid"
  | "primaryLanguageInvalid"
  | "countryTooLong"
  | "titleFigureRequired";

export type ParseBookDraftJsonForImportResult =
  | {
      ok: true;
      payload: BookDraftPayloadV1;
      label: string;
    }
  | {
      ok: false;
      errorKey: ParseBookDraftJsonForImportErrorKey;
    };

function chaptersFromImportValue(ch: unknown):
  | { ok: true; chapters: BookDraftPayloadV1["chapters"] }
  | { ok: false; errorKey: "invalidChapterJson" | "maxWizardSections" } {
  if (ch == null || (Array.isArray(ch) && ch.length === 0)) {
    return { ok: true, chapters: null };
  }
  if (!Array.isArray(ch)) {
    return { ok: false, errorKey: "invalidChapterJson" };
  }
  if (ch.length > MAX_AUTO_WIZARD_PUBLISH_SECTIONS) {
    return { ok: false, errorKey: "maxWizardSections" };
  }
  const out: { slug: string; title: string; body: string }[] = [];
  const seen = new Set<string>();
  for (const row of ch) {
    if (!row || typeof row !== "object") {
      return { ok: false, errorKey: "invalidChapterJson" };
    }
    const r = row as Record<string, unknown>;
    const title =
      typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    const body = typeof r.body === "string" ? r.body.trim() : "";
    const slugRaw = typeof r.slug === "string" ? r.slug.trim() : "";
    const slug = slugify(slugRaw || title);
    if (!title || !slug) {
      return { ok: false, errorKey: "invalidChapterJson" };
    }
    if (isReservedSlug(slug)) {
      return { ok: false, errorKey: "invalidChapterJson" };
    }
    const lower = slug.toLowerCase();
    if (seen.has(lower)) {
      return { ok: false, errorKey: "invalidChapterJson" };
    }
    seen.add(lower);
    out.push({ slug, title, body });
  }
  return { ok: true, chapters: out.length ? out : null };
}

/**
 * Parse and validate a JSON file produced by the local book builder (or compatible tools)
 * before storing as a BOOK `ContentDraft` row.
 */
export function parseBookDraftJsonForImport(
  rawText: string,
): ParseBookDraftJsonForImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return { ok: false, errorKey: "bookDraftImportInvalidJson" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, errorKey: "bookDraftImportInvalidPayload" };
  }
  const o = parsed as Record<string, unknown>;
  if (o.v !== BOOK_DRAFT_PAYLOAD_VERSION) {
    return { ok: false, errorKey: "bookDraftImportInvalidPayload" };
  }
  const title = typeof o.title === "string" ? o.title : "";
  const figureName = typeof o.figureName === "string" ? o.figureName : "";
  if (!title.trim() || !figureName.trim()) {
    return { ok: false, errorKey: "titleFigureRequired" };
  }
  const intendedAges =
    typeof o.intendedAges === "string" ? o.intendedAges.trim() : "";
  if (!intendedAges || !isKnownIntendedAudience(intendedAges)) {
    return { ok: false, errorKey: "intendedAgesInvalid" };
  }
  const defaultLocale =
    typeof o.defaultLocale === "string" ? o.defaultLocale.trim() : "";
  if (!defaultLocale || !isKnownBookLocale(defaultLocale)) {
    return { ok: false, errorKey: "primaryLanguageInvalid" };
  }
  const country = typeof o.country === "string" ? o.country.trim() : "";
  if (country.length > 255) {
    return { ok: false, errorKey: "countryTooLong" };
  }
  const summary = typeof o.summary === "string" ? o.summary : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  const tags = typeof o.tags === "string" ? o.tags : "";
  const includeIntroduction =
    o.includeIntroduction === true || o.includeIntroduction === "true";
  const figureVerifiedKind =
    typeof o.figureVerifiedKind === "string"
      ? o.figureVerifiedKind.trim()
      : "";
  const figureVerifiedKey =
    typeof o.figureVerifiedKey === "string" ? o.figureVerifiedKey.trim() : "";

  const chRes = chaptersFromImportValue(o.chapters ?? null);
  if (!chRes.ok) {
    return { ok: false, errorKey: chRes.errorKey };
  }
  const chapters = chRes.chapters;

  const payload: BookDraftPayloadV1 = {
    v: BOOK_DRAFT_PAYLOAD_VERSION,
    title,
    figureName,
    intendedAges,
    country,
    summary,
    slug,
    tags,
    defaultLocale,
    includeIntroduction,
    figureVerifiedKind,
    figureVerifiedKey,
    chapters,
  };
  const label = (title.trim() || figureName.trim() || "Untitled book draft").slice(
    0,
    512,
  );
  return { ok: true, payload, label };
}
