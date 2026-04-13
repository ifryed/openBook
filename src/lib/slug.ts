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
