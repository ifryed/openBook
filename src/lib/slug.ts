const RESERVED = new Set([
  "new",
  "edit",
  "history",
  "api",
  "talk",
  "login",
  "signup",
  "register",
  "_next",
  "favicon.ico",
]);

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const MAX_BOOK_SLUG_LEN = 80;

/**
 * Short segment from a figure name for default book URLs:
 * - "Curie, Marie" → "Curie" (bibliographic order)
 * - "Marie Curie" → "Curie" (two-word → last token as surname)
 * - longer names → first token (e.g. "Hypatia of Alexandria" → "Hypatia")
 */
export function shortFigureNameForSlug(figureName: string): string {
  const t = figureName.trim();
  if (!t) return "";
  const comma = t.indexOf(",");
  if (comma !== -1) {
    return t.slice(0, comma).trim();
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 2) {
    return words[1]!;
  }
  return words[0]!;
}

/**
 * Default book slug when the editor leaves the slug field blank: shortened figure + title.
 */
export function defaultBookSlug(figureName: string, title: string): string {
  const figurePart = slugify(shortFigureNameForSlug(figureName));
  const titlePart = slugify(title);
  if (!figurePart && !titlePart) return "";
  if (!figurePart) return titlePart.slice(0, MAX_BOOK_SLUG_LEN);
  if (!titlePart) return figurePart.slice(0, MAX_BOOK_SLUG_LEN);
  const joined = `${figurePart}-${titlePart}`.replace(/-+/g, "-");
  return joined.replace(/^-+|-+$/g, "").slice(0, MAX_BOOK_SLUG_LEN);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}

/**
 * Turn `title` into a URL slug and ensure it is unique within `taken` (lowercase compared).
 * Appends -2, -3, … if needed; skips reserved slugs.
 */
export function uniqueSlugify(title: string, taken: Set<string>): string {
  const base = slugify(title);
  if (!base) return "";
  const lowerTaken = new Set(
    [...taken].map((s) => s.toLowerCase()),
  );
  let candidate = base;
  let n = 2;
  while (
    lowerTaken.has(candidate.toLowerCase()) ||
    isReservedSlug(candidate)
  ) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return "";
  }
  return candidate;
}

/**
 * Prefer a model-provided slug (normalized); fall back to title. Ensures uniqueness in `taken`.
 */
export function uniqueSlugFromPreferred(
  preferredRaw: string | null | undefined,
  title: string,
  taken: Set<string>,
): string {
  const fromPreferred = preferredRaw?.trim() ? slugify(preferredRaw) : "";
  const fromTitle = slugify(title);
  const base = fromPreferred || fromTitle;
  if (!base) return "";
  const lowerTaken = new Set([...taken].map((s) => s.toLowerCase()));
  let candidate = base;
  let n = 2;
  while (
    lowerTaken.has(candidate.toLowerCase()) ||
    isReservedSlug(candidate)
  ) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return "";
  }
  return candidate;
}
