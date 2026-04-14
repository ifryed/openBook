import { uniqueSlugFromPreferred } from "@/lib/slug";

export type TocSuggestion = {
  title: string;
  slug: string;
};

/** Strip optional ```json fences for scanning. */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/** First balanced `[...]` in the string, parsed as JSON array. */
function extractFirstJsonArray(raw: string): unknown[] | null {
  const scan = stripCodeFences(raw);
  const start = scan.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < scan.length; i++) {
    const c = scan[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(scan.slice(start, i + 1)) as unknown;
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Parse one JSON object starting at `start` using brace depth (strings ignored).
 * Handles models that emit trailing junk after valid title/slug fields.
 */
function tryParseBalancedObject(
  raw: string,
  start: number,
): { value: Record<string, unknown>; end: number } | null {
  if (raw[start] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = raw.slice(start, i + 1);
        try {
          const value = JSON.parse(slice) as Record<string, unknown>;
          return { value, end: i + 1 };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function unescapeCapturedJsonString(s: string): string {
  return s.replace(/\\(.)/g, (_, ch: string) => {
    if (ch === '"') return '"';
    if (ch === "\\") return "\\";
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    return ch;
  });
}

/** Last resort: title+slug pairs when JSON is broken (supports either key order). */
function looseTitleSlugPairs(
  raw: string,
): Array<{ title: string; slugRaw: string }> {
  const out: Array<{ title: string; slugRaw: string }> = [];
  const seen = new Set<string>();
  const push = (title: string, slugRaw: string) => {
    const t = title.trim().slice(0, 120);
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ title: t, slugRaw: slugRaw.trim() });
  };
  const reTitleFirst =
    /"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"slug"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = reTitleFirst.exec(raw)) !== null) {
    push(
      unescapeCapturedJsonString(m[1]),
      unescapeCapturedJsonString(m[2]),
    );
  }
  const reSlugFirst =
    /"slug"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((m = reSlugFirst.exec(raw)) !== null) {
    push(
      unescapeCapturedJsonString(m[2]),
      unescapeCapturedJsonString(m[1]),
    );
  }
  return out;
}

function chapterFromRecord(
  r: Record<string, unknown>,
): { title: string; slugRaw?: string } | null {
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
  if (!title) return null;
  const slugRaw =
    typeof r.slug === "string" && r.slug.trim() ? r.slug.trim() : undefined;
  return slugRaw ? { title, slugRaw } : { title };
}

/** Collect chapter rows: JSON array, NDJSON lines, `{...}` scan, then regex fallback. */
function collectChapterRows(
  raw: string,
): Array<{ title: string; slugRaw?: string }> {
  const trimmed = stripCodeFences(raw);
  const out: Array<{ title: string; slugRaw?: string }> = [];
  const seenTitle = new Set<string>();

  const push = (r: Record<string, unknown>) => {
    const row = chapterFromRecord(r);
    if (!row || seenTitle.has(row.title)) return;
    seenTitle.add(row.title);
    out.push(row);
  };

  const arr = extractFirstJsonArray(trimmed);
  if (arr) {
    for (const item of arr) {
      if (item && typeof item === "object") push(item as Record<string, unknown>);
    }
    if (out.length > 0) return out;
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    const got = tryParseBalancedObject(t, 0);
    if (got) push(got.value);
  }
  if (out.length > 0) return out;

  let pos = 0;
  while (pos < trimmed.length) {
    const b = trimmed.indexOf("{", pos);
    if (b === -1) break;
    const got = tryParseBalancedObject(trimmed, b);
    if (!got) {
      pos = b + 1;
      continue;
    }
    push(got.value);
    pos = got.end;
  }
  if (out.length > 0) return out;

  return looseTitleSlugPairs(trimmed);
}

/** Parses step 2: model supplies title + slug; we normalize and dedupe slugs. */
export function parseTocFromLlmText(raw: string): TocSuggestion[] {
  const rows = collectChapterRows(raw);
  const usedSlugs = new Set<string>();
  const out: TocSuggestion[] = [];
  for (const row of rows) {
    const slug = uniqueSlugFromPreferred(row.slugRaw, row.title, usedSlugs);
    if (!slug) continue;
    usedSlugs.add(slug);
    out.push({ title: row.title, slug });
  }
  return out;
}
