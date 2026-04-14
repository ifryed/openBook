/**
 * Wikipedia + Wikidata search hits for picking a real person (same public APIs as
 * reference lookup). Results are limited to Wikidata entities with instance of (P31)
 * human (Q5), so fictional characters are excluded when Wikidata can classify them.
 */

const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_LIMIT = 12;
/** Wikidata: instance of → human (real person, not fictional character). */
const WIKIDATA_HUMAN_QID = "Q5";

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

type WbStatement = {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value?: { id?: string } };
  };
};

type WbGetEntitiesResp = {
  entities?: Record<
    string,
    | { missing?: string; claims?: Record<string, WbStatement[]> }
    | undefined
  >;
};

function entityIsHuman(
  ent: { missing?: string; claims?: Record<string, WbStatement[]> } | undefined,
): boolean {
  if (!ent || ent.missing) return false;
  const p31 = ent.claims?.P31;
  if (!Array.isArray(p31)) return false;
  for (const stmt of p31) {
    if (stmt?.mainsnak?.snaktype !== "value") continue;
    const id = stmt.mainsnak.datavalue?.value?.id;
    if (id === WIKIDATA_HUMAN_QID) return true;
  }
  return false;
}

/**
 * Batch-fetch P31 and return Q-ids that are instance of human (Q5).
 */
async function wikidataIdsThatAreHumans(
  ids: string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter((id) => /^Q\d+$/.test(id)))];
  const humans = new Set<string>();
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const url =
      `https://www.wikidata.org/w/api.php?` +
      new URLSearchParams({
        action: "wbgetentities",
        ids: chunk.join("|"),
        props: "claims",
        format: "json",
      });
    const data = await fetchJson<WbGetEntitiesResp>(url.toString());
    const entities = data?.entities ?? {};
    for (const id of chunk) {
      if (entityIsHuman(entities[id])) humans.add(id);
    }
  }
  return humans;
}

type WikiQueryTitlesResp = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        missing?: string;
        pageprops?: { wikibase_item?: string };
      }
    >;
  };
};

/**
 * Map English Wikipedia article titles to Wikidata Q-ids (via sitelink), when present.
 */
async function wikipediaTitlesToWikidataIds(
  titles: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (titles.length === 0) return map;
  const chunkSize = 50;
  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize);
    const url =
      `https://en.wikipedia.org/w/api.php?` +
      new URLSearchParams({
        action: "query",
        titles: chunk.join("|"),
        prop: "pageprops",
        ppprop: "wikibase_item",
        format: "json",
      });
    const data = await fetchJson<WikiQueryTitlesResp>(url.toString());
    const pages = data?.query?.pages ?? {};
    for (const p of Object.values(pages)) {
      if (p.missing || !p.title) continue;
      const qid = p.pageprops?.wikibase_item?.trim();
      if (qid && /^Q\d+$/.test(qid)) map.set(p.title, qid);
    }
  }
  return map;
}

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
  options?: { searchLimit?: number },
): Promise<FigureCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const limit = options?.searchLimit ?? SEARCH_LIMIT;
  const [wiki, wd] = await Promise.all([
    wikipediaSearchCandidates(q, limit),
    wikidataSearchCandidates(q, limit),
  ]);
  const titleToQid = await wikipediaTitlesToWikidataIds(wiki.map((h) => h.title));
  const allQids = [
    ...wd.map((h) => h.id),
    ...[...titleToQid.values()],
  ];
  const humans = await wikidataIdsThatAreHumans(allQids);

  const wikiFiltered = wiki.filter((h) => {
    const qid = titleToQid.get(h.title);
    return qid !== undefined && humans.has(qid);
  });
  const wdFiltered = wd.filter((h) => humans.has(h.id));

  return [...wikiFiltered, ...wdFiltered];
}

/**
 * Ensures the chosen Wikipedia title or Wikidata id appears in the same filtered
 * candidate set as {@link fetchFigureCandidates} (real humans only; prevents forged
 * hidden fields).
 */
export async function assertFigurePickInSearchResults(
  figureName: string,
  kind: "wikipedia" | "wikidata",
  key: string,
): Promise<boolean> {
  const q = figureName.trim();
  if (q.length < 2 || !key.trim()) return false;

  const candidates = await fetchFigureCandidates(q, { searchLimit: 25 });
  if (kind === "wikipedia") {
    return candidates.some((c) => c.source === "wikipedia" && c.title === key);
  }
  return candidates.some((c) => c.source === "wikidata" && c.id === key);
}
