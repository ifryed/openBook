/** Max chars sent to the local LLM as “whole book” context (rest truncated). */
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

/**
 * Markdown block listing every section’s latest body, with the current section marked.
 */
export function buildBookContextMarkdown(
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
  let out = parts.join("\n---\n\n");
  if (out.length > MAX_BOOK_CONTEXT_CHARS) {
    out =
      out.slice(0, MAX_BOOK_CONTEXT_CHARS) +
      "\n\n[... book context truncated for length ...]";
  }
  return out;
}
