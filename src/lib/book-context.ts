/** Max chars for the book-context block sent to the local LLM (full or compact). */
export const MAX_BOOK_CONTEXT_CHARS = 14_000;

const MAX_INTENDED_AGES_LEN = 255;

/**
 * Text block for LLM prompts: reading level and sensitivity from the book’s intended ages/audience.
 */
export function intendedAudiencePromptSnippet(intendedAges: string): string {
  const t = intendedAges.trim().slice(0, MAX_INTENDED_AGES_LEN);
  if (t.length > 0) {
    return `Intended readership (ages / audience): ${t}. Match vocabulary, sentence length, and how explicitly you treat difficult themes to this audience while staying accurate and neutral.`;
  }
  return `Intended readership (ages / audience): not set on this book — use clear, neutral prose suitable for a general adult reader unless the editor specifies otherwise in their notes.`;
}

export type SectionContextInput = {
  slug: string;
  title: string;
  body: string;
};

/** User-message paragraph describing the BOOK CONTEXT block (full vs compact). */
export function bookContextPromptInstruction(): string {
  return (
    "Below is structured context from this book (Markdown). " +
    "For shorter books, every chapter’s latest text appears in order, separated by ---. " +
    "For longer books, only the **table of contents** (all titles) and the **full text of the last chapter** appear so the prompt fits the model’s context limit. " +
    "The chapter to generate is marked; it is your ONLY output target. Stay consistent with names, dates, and tone in this context, but do not copy other chapters verbatim."
  );
}

function buildFullBookContextMarkdown(
  sections: SectionContextInput[],
  currentSectionSlug: string,
): string {
  const parts = sections.map((s) => {
    const isCurrent = s.slug === currentSectionSlug;
    const marker = isCurrent
      ? "\n\n_(**This is the chapter you are generating.** Your output must be only this chapter’s Markdown, not the others.)_\n"
      : "";
    const body = s.body.trim() || "_(empty)_";
    return `## ${s.title}${marker}\n\n${body}\n`;
  });
  return parts.join("\n---\n\n");
}

function buildCompactBookContextMarkdown(
  sections: SectionContextInput[],
  currentSectionSlug: string,
  maxTotalChars: number,
): string {
  if (sections.length === 0) {
    return "_(No sections in this book.)_";
  }

  const toc = sections
    .map((s, i) => {
      const mark =
        s.slug === currentSectionSlug ? " ← **chapter to generate**" : "";
      return `${i + 1}. **${s.title}** (\`${s.slug}\`)${mark}`;
    })
    .join("\n");

  const last = sections[sections.length - 1]!;
  const isCurrent = last.slug === currentSectionSlug;
  const marker = isCurrent
    ? "\n\n_(**This is the chapter you are generating.** Your output must be only this chapter’s Markdown.)_\n"
    : "";

  const header = [
    "_The manuscript is long, so this context lists every chapter title and includes the **full text of only the last chapter** (latest in the book order) for tone and continuity. Rely on reference snippets and your guides for facts from earlier periods._",
    "",
    "## Table of contents",
    toc,
    "",
    "---",
    "",
    `## Last chapter: ${last.title}${marker}`,
  ].join("\n");

  const body = last.body.trim() || "_(empty)_";
  const budgetForBody = Math.max(512, maxTotalChars - header.length - 80);
  let bodyOut = body;
  if (bodyOut.length > budgetForBody) {
    bodyOut =
      bodyOut.slice(0, budgetForBody) +
      "\n\n[... last chapter truncated for length ...]";
  }

  return `${header}${bodyOut}\n`;
}

/**
 * Markdown block listing every section’s latest body, with the current section marked.
 * If the full book would exceed {@link MAX_BOOK_CONTEXT_CHARS}, sends the table of contents
 * plus the **last** chapter’s full text instead (fits long books within the model context).
 */
export function buildBookContextMarkdown(
  sections: SectionContextInput[],
  currentSectionSlug: string,
): string {
  const full = buildFullBookContextMarkdown(sections, currentSectionSlug);
  let out =
    full.length <= MAX_BOOK_CONTEXT_CHARS
      ? full
      : buildCompactBookContextMarkdown(
          sections,
          currentSectionSlug,
          MAX_BOOK_CONTEXT_CHARS,
        );

  if (out.length > MAX_BOOK_CONTEXT_CHARS) {
    out =
      out.slice(0, MAX_BOOK_CONTEXT_CHARS) +
      "\n\n[... book context truncated for length ...]";
  }
  return out;
}
