import { MAX_LLM_TOC_SECTIONS } from "@/lib/book-limits";

export function clampTargetNewChapters(n: number): number {
  if (!Number.isFinite(n)) return 8;
  return Math.min(MAX_LLM_TOC_SECTIONS, Math.max(3, Math.round(n)));
}

/** Bullet count range for Step 1 scales with how many new chapters Step 2 will request. */
export function lifeEventsBulletRange(targetNewChapters: number): {
  lo: number;
  hi: number;
} {
  const t = clampTargetNewChapters(targetNewChapters);
  const lo = Math.max(8, Math.min(16, t + 2));
  const hi = Math.max(lo + 2, Math.min(24, t * 2 + 6));
  return { lo, hi };
}

/**
 * Step 1 user-message block: explain that life-event bullets must cover enough
 * material for exactly `targetNewChapters` upcoming TOC rows.
 */
export function tocStep1ChapterBudgetNarrative(
  targetNewChapters: number,
  options?: { existingSectionNote?: string },
): string {
  const n = clampTargetNewChapters(targetNewChapters);
  const existing =
    options?.existingSectionNote ??
    "The book may already have an Introduction and other sections; these bullets only need to support the new chapters you are about to plan.";

  return `Chapter budget: Step 2 will ask for exactly ${n} NEW chapter entries (title + slug each). ${existing}

Your bullet list must supply enough distinct, well-attested material across this figure’s life and public significance so that each of those ${n} chapters can be substantive and non-redundant. Include chronological phases, major roles or offices, achievements and works, crises and turning points, relationships to wider historical context, intellectual or cultural themes, legacy, reception, and significant controversies where standard reference works discuss them.

When ${n} is larger, prefer finer-grained periods and sub-themes (still one idea per bullet) rather than repeating the same story. When ${n} is smaller, you may stay broader but do not omit themes a reader would expect in a balanced biography. Each bullet should be concrete enough that a chapter could be outlined from it.`;
}

/** Suggested max_tokens for Step 1 given bullet ceiling. */
export function tocStep1MaxTokens(bulletHi: number): number {
  return Math.min(3200, Math.max(1400, 900 + bulletHi * 85));
}
