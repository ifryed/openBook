/** Canonical default when no locale is configured. */
export const DEFAULT_BOOK_LOCALE = "en";

export type BookLocaleOption = { code: string; label: string };

/**
 * Allowlist for UI and server validation (ISO 639-1 primary language tags).
 * ~28 widely used languages plus common picks for biographies.
 */
export const BOOK_LOCALE_OPTIONS: BookLocaleOption[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese (Mandarin)" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "bn", label: "Bengali" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ur", label: "Urdu" },
  { code: "id", label: "Indonesian" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "sw", label: "Swahili" },
  { code: "mr", label: "Marathi" },
  { code: "te", label: "Telugu" },
  { code: "tr", label: "Turkish" },
  { code: "ta", label: "Tamil" },
  { code: "vi", label: "Vietnamese" },
  { code: "ko", label: "Korean" },
  { code: "it", label: "Italian" },
  { code: "th", label: "Thai" },
  { code: "gu", label: "Gujarati" },
  { code: "fa", label: "Persian (Farsi)" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "nl", label: "Dutch" },
];

/** Filter by English name or ISO code (case-insensitive). */
export function filterBookLocaleOptions(
  options: BookLocaleOption[],
  query: string,
): BookLocaleOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
  );
}

const KNOWN = new Set(BOOK_LOCALE_OPTIONS.map((o) => o.code));

export function isKnownBookLocale(code: string): boolean {
  return KNOWN.has(code.trim());
}

export function bookLocaleLabel(code: string): string {
  const c = code.trim();
  return BOOK_LOCALE_OPTIONS.find((o) => o.code === c)?.label ?? c;
}

/**
 * Parse repeated form fields: languages, languages[].
 * Dedupes, preserves order, filters unknown codes.
 */
export function parseBookLocalesFromFormData(formData: FormData): string[] {
  const raw = formData.getAll("languages").concat(formData.getAll("languages[]"));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v).trim();
    if (!s || seen.has(s) || !isKnownBookLocale(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function normalizeActiveLocale(
  requested: string | undefined | null,
  bookLocales: string[],
  defaultLocale: string,
): string {
  const r = requested?.trim() ?? "";
  if (r && bookLocales.includes(r)) return r;
  if (bookLocales.includes(defaultLocale)) return defaultLocale;
  return bookLocales[0] ?? DEFAULT_BOOK_LOCALE;
}

export function withLangQuery(
  path: string,
  locale: string | undefined | null,
): string {
  if (!locale?.trim()) return path;
  const q = new URLSearchParams({ lang: locale.trim() });
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${q.toString()}`;
}
