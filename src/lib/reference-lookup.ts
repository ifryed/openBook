/**
 * Fetches short factual snippets from public sources (Wikipedia, Wikidata, Open Library,
 * Grokipedia) for injection into draft prompts. Intended for server-side use only.
 *
 * @see https://meta.wikimedia.org/wiki/User-Agent_policy
 * @see https://grokipedia.com/ — articles at /page/{slug}; verify content independently.
 */

export const MAX_REF_QUERIES = 5;
const MAX_EXTRACT_CHARS = 1400;
const MAX_GROKIPEDIA_EXTRACT_CHARS = 2200;
const MAX_GROKIPEDIA_HTML_BYTES = 512 * 1024;
const GROKIPEDIA_ORIGIN = "https://grokipedia.com";
const FETCH_TIMEOUT_MS = 12_000;

function userAgent(): string {
  const custom = process.env.REFERENCE_LOOKUP_USER_AGENT?.trim();
  if (custom) return custom;
  return "OpenBook/1.0 (biography draft reference lookup; +https://github.com)";
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

/**
 * Stream HTML until </main> or size cap so huge articles (e.g. country pages) do not
 * buffer entirely in memory.
 */
async function fetchHtmlCapped(
  url: string,
  maxBytes: number,
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": userAgent(),
      },
    });
    if (!res.ok) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = "";
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      text += decoder.decode(value, { stream: true });
      if (text.toLowerCase().includes("</main>")) break;
    }
    text += decoder.decode();
    await reader.cancel().catch(() => {});
    return text;
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function extractOgDescription(html: string): string {
  const og = html.match(
    /property="og:description"\s+content="([^"]*)"/i,
  );
  if (og?.[1]) return decodeBasicHtmlEntities(og[1]).trim();
  const meta = html.match(/name="description"\s+content="([^"]*)"/i);
  if (meta?.[1]) return decodeBasicHtmlEntities(meta[1]).trim();
  return "";
}

function extractGrokipediaMainText(html: string): string | null {
  const lower = html.toLowerCase();
  const start = lower.indexOf("<main");
  if (start === -1) return null;
  const openEnd = html.indexOf(">", start);
  if (openEnd === -1) return null;
  const close = lower.indexOf("</main>", openEnd);
  /** Truncated fetch may end before `</main>` on very long articles (e.g. country pages). */
  const end = close === -1 ? html.length : close;
  const inner = html.slice(openEnd + 1, end);
  const noScript = inner
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noScript.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function extractGrokipediaTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (!m?.[1]) return null;
  const raw = decodeBasicHtmlEntities(m[1].trim());
  const cut = raw.split(/\s[—–-]\s/)[0]?.trim();
  return cut || raw || null;
}

function grokipediaSlugCandidates(query: string): string[] {
  const t = query.trim();
  if (t.length < 2) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const x = s.trim();
    if (x.length >= 2 && !out.includes(x)) out.push(x);
  };

  if (/^[\w.-]+$/i.test(t) && !/\s/.test(t)) {
    push(t);
  }

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length) {
    const titled = words
      .map(
        (w) =>
          w.length <= 1
            ? w.toUpperCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
      .join("_");
    push(titled);
    push(words.map((w) => w.toLowerCase()).join("-"));
    push(words.map((w) => w.toLowerCase()).join("_"));
  }

  return out.slice(0, 4);
}

export async function grokipediaSnippetForQuery(
  query: string,
): Promise<{ title: string; url: string; extract: string } | null> {
  const slugs = grokipediaSlugCandidates(query);
  for (const slug of slugs) {
    const pathSlug = encodeURIComponent(slug).replace(/%2F/gi, "/");
    const url = `${GROKIPEDIA_ORIGIN}/page/${pathSlug}`;
    const html = await fetchHtmlCapped(url, MAX_GROKIPEDIA_HTML_BYTES);
    if (!html) continue;

    const mainText = extractGrokipediaMainText(html);
    const og = extractOgDescription(html);
    const pageTitle = extractGrokipediaTitle(html);

    if (!pageTitle || /not found/i.test(pageTitle)) continue;
    if (!mainText && !og) continue;

    let extract = "";
    if (mainText && mainText.length > 120) {
      extract = mainText.slice(0, MAX_GROKIPEDIA_EXTRACT_CHARS);
      if (mainText.length > MAX_GROKIPEDIA_EXTRACT_CHARS) extract += "…";
    } else if (og) {
      extract = og.slice(0, MAX_GROKIPEDIA_EXTRACT_CHARS);
    } else {
      continue;
    }

    const title = pageTitle || slug.replace(/_/g, " ");

    return {
      title,
      url,
      extract: extract.trim(),
    };
  }
  return null;
}

type WikiSearchResp = {
  query?: { search?: { title: string; pageid: number }[] };
};
type WikiExtractResp = {
  query?: {
    pages?: Record<
      string,
      { title?: string; extract?: string; missing?: boolean }
    >;
  };
};

export async function wikipediaSnippetForQuery(
  query: string,
): Promise<{ title: string; url: string; extract: string } | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const searchUrl =
    `https://en.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: q,
      srlimit: "1",
      format: "json",
    });

  const search = await fetchJson<WikiSearchResp>(searchUrl.toString());
  const hit = search?.query?.search?.[0];
  if (!hit?.title) return null;

  const extractUrl =
    `https://en.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: hit.title,
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exchars: String(MAX_EXTRACT_CHARS),
      format: "json",
    });

  const ex = await fetchJson<WikiExtractResp>(extractUrl.toString());
  const page = Object.values(ex?.query?.pages ?? {})[0];
  if (!page || page.missing || !page.extract?.trim()) return null;

  const title = page.title ?? hit.title;
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  return {
    title,
    url,
    extract: page.extract.trim(),
  };
}

type WikidataSearchResp = {
  search?: { label: string; description?: string; id: string }[];
};

export async function wikidataDescriptionForQuery(
  query: string,
): Promise<{ label: string; description: string; url: string } | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url =
    `https://www.wikidata.org/w/api.php?` +
    new URLSearchParams({
      action: "wbsearchentities",
      search: q,
      language: "en",
      limit: "1",
      format: "json",
    });

  const data = await fetchJson<WikidataSearchResp>(url.toString());
  const hit = data?.search?.[0];
  if (!hit?.label) return null;
  const desc = hit.description?.trim();
  if (!desc) return null;
  return {
    label: hit.label,
    description: desc,
    url: `https://www.wikidata.org/wiki/${hit.id}`,
  };
}

type OpenLibraryResp = {
  docs?: {
    title?: string;
    author_name?: string[];
    first_publish_year?: number;
  }[];
};

export async function openLibraryLinesForQuery(
  query: string,
): Promise<string | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url = `https://openlibrary.org/search.json?${new URLSearchParams({
    q,
    limit: "3",
  })}`;

  const data = await fetchJson<OpenLibraryResp>(url.toString());
  const docs = data?.docs;
  if (!docs?.length) return null;

  const lines = docs
    .map((d) => {
      const t = d.title?.trim();
      if (!t) return null;
      const authors = d.author_name?.slice(0, 2).join(", ") ?? "";
      const y = d.first_publish_year ? ` (${d.first_publish_year})` : "";
      return authors ? `“${t}”${y} — ${authors}` : `“${t}”${y}`;
    })
    .filter(Boolean) as string[];

  if (!lines.length) return null;
  return lines.join("; ");
}

export function buildReferenceSearchQueries(input: {
  guides: string;
  figureName: string;
  sectionTitle: string;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length < 3 || t.length > 200) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  if (input.figureName) push(input.figureName);

  const lines = input.guides
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    push(line);
    if (out.length >= MAX_REF_QUERIES) break;
  }

  if (out.length < MAX_REF_QUERIES && input.sectionTitle.trim().length >= 3) {
    push(input.sectionTitle.trim());
  }

  return out.slice(0, MAX_REF_QUERIES);
}

export async function gatherReferenceSnippetsMarkdown(input: {
  guides: string;
  figureName: string;
  sectionTitle: string;
}): Promise<string> {
  const queries = buildReferenceSearchQueries(input);
  if (queries.length === 0) {
    return "";
  }

  const parts: string[] = [];

  // One Wikidata line for the figure (if we have a name) — often a crisp description
  if (input.figureName.trim().length >= 2) {
    const wd = await wikidataDescriptionForQuery(input.figureName.trim());
    if (wd) {
      parts.push(
        `### Wikidata (entity summary)\n**${wd.label}** — ${wd.description}\nSource: ${wd.url}\n`,
      );
    }
  }

  const usedWikiTitles = new Set<string>();

  const usedGrokipediaUrls = new Set<string>();

  for (const q of queries) {
    const [wiki, ol, gk] = await Promise.all([
      wikipediaSnippetForQuery(q),
      openLibraryLinesForQuery(q),
      grokipediaSnippetForQuery(q),
    ]);
    if (wiki && !usedWikiTitles.has(wiki.title.toLowerCase())) {
      usedWikiTitles.add(wiki.title.toLowerCase());
      parts.push(
        `### Wikipedia: ${wiki.title}\n${wiki.extract}\nSource: ${wiki.url}\n`,
      );
    }

    if (ol) {
      parts.push(`### Open Library (catalog search: “${q}”)\n${ol}\n`);
    }

    if (gk && !usedGrokipediaUrls.has(gk.url.toLowerCase())) {
      usedGrokipediaUrls.add(gk.url.toLowerCase());
      parts.push(
        `### Grokipedia: ${gk.title}\n${gk.extract}\nSource: ${gk.url}\n`,
      );
    }
  }

  return parts.join("\n").trim();
}
