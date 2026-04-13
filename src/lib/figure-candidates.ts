/**
 * Wikipedia + Wikidata search hits for picking a historical figure (same public APIs
 * as reference lookup).
 */

const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_LIMIT = 12;

function userAgent(): string {
  const custom = process.env.REFERENCE_LOOKUP_USER_AGENT?.trim();
  if (custom) return custom;
  return "OpenBook/1.0 (figure name lookup; +https://github.com)";
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function stripWikiSnippet(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export type WikipediaFigureCandidate = {
  source: "wikipedia";
  title: string;
  url: string;
  snippet: string;
};

export type WikidataFigureCandidate = {
  source: "wikidata";
  id: string;
  label: string;
  description: string;
  url: string;
};

export type FigureCandidate = WikipediaFigureCandidate | WikidataFigureCandidate;

type WikiSearchListResp = {
  query?: { search?: { title: string; snippet?: string }[] };
};

export async function wikipediaSearchCandidates(
  query: string,
  limit = SEARCH_LIMIT,
): Promise<WikipediaFigureCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `https://en.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: q,
      srlimit: String(Math.min(limit, 25)),
      srprop: "snippet",
      format: "json",
    });

  const data = await fetchJson<WikiSearchListResp>(url.toString());
  const hits = data?.query?.search ?? [];
  return hits.map((h) => ({
    source: "wikipedia" as const,
    title: h.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`,
    snippet: stripWikiSnippet(h.snippet ?? ""),
  }));
}

type WikidataSearchResp = {
  search?: { id: string; label: string; description?: string }[];
};

export async function wikidataSearchCandidates(
  query: string,
  limit = SEARCH_LIMIT,
): Promise<WikidataFigureCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `https://www.wikidata.org/w/api.php?` +
    new URLSearchParams({
      action: "wbsearchentities",
      search: q,
      language: "en",
      limit: String(Math.min(limit, 25)),
      format: "json",
    });

  const data = await fetchJson<WikidataSearchResp>(url.toString());
  const hits = data?.search ?? [];
  return hits.map((h) => ({
    source: "wikidata" as const,
    id: h.id,
    label: h.label,
    description: (h.description ?? "").trim(),
    url: `https://www.wikidata.org/wiki/${h.id}`,
  }));
}

export async function fetchFigureCandidates(
  query: string,
): Promise<FigureCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [wiki, wd] = await Promise.all([
    wikipediaSearchCandidates(q),
    wikidataSearchCandidates(q),
  ]);
  return [...wiki, ...wd];
}

/**
 * Ensures the chosen Wikipedia title or Wikidata id appears in fresh search results
 * for the submitted figure name (prevents forged hidden fields).
 */
export async function assertFigurePickInSearchResults(
  figureName: string,
  kind: "wikipedia" | "wikidata",
  key: string,
): Promise<boolean> {
  const q = figureName.trim();
  if (q.length < 2 || !key.trim()) return false;

  if (kind === "wikipedia") {
    const hits = await wikipediaSearchCandidates(q, 25);
    return hits.some((h) => h.title === key);
  }

  const hits = await wikidataSearchCandidates(q, 25);
  return hits.some((h) => h.id === key);
}
