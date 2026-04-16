/** Relative URL for the book download API (no site locale prefix). */
export function bookDownloadRelativeUrl(
  bookSlug: string,
  format: string,
  exportLang?: string,
): string {
  const enc = encodeURIComponent(bookSlug);
  const base = `/api/books/${enc}/download`;
  const q = new URLSearchParams({ format });
  const l = exportLang?.trim();
  if (l) q.set("lang", l);
  return `${base}?${q.toString()}`;
}
