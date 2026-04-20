"""TOC step prompts (aligned with openBook auto-book-wizard + llm-toc-prompts)."""

from __future__ import annotations

import math

from openbook_bookbuilder.book_context import intended_audience_prompt_snippet


def clamp_target_new_chapters(n: float | int) -> int:
    try:
        x = float(n)
    except (TypeError, ValueError):
        return 8
    if not math.isfinite(x):
        return 8
    return min(2000, max(1, round(x)))


def life_events_bullet_range(target_new_chapters: int) -> tuple[int, int]:
    t = clamp_target_new_chapters(target_new_chapters)
    lo = max(4, min(80, int(t * 0.35) + 4))
    hi = max(lo + 3, min(500, int(t * 1.1) + 10))
    return lo, hi


def toc_step1_chapter_budget_narrative(
    target_new_chapters: int,
    *,
    draft_introduction_with_ai: bool,
) -> str:
    n = clamp_target_new_chapters(target_new_chapters)
    existing = (
        "The final book will include an AI-written Introduction plus the biography chapters from the next step; "
        "these bullets support only those biography chapters (not the introduction)."
        if draft_introduction_with_ai
        else "These bullets support only the new biography chapters in the next step."
    )
    return f"""Chapter budget: Step 2 will ask for exactly {n} NEW chapter entries (title + slug each). {existing}

Your bullet list must supply enough distinct, well-attested material across this figure's life and public significance so that each of those {n} chapters can be substantive and non-redundant. Include chronological phases, major roles or offices, achievements and works, crises and turning points, relationships to wider historical context, intellectual or cultural themes, legacy, reception, and significant controversies where standard reference works discuss them.

When {n} is larger, prefer finer-grained periods and sub-themes (still one idea per bullet) rather than repeating the same story. When {n} is smaller, you may stay broader but do not omit themes a reader would expect in a balanced biography. Each bullet should be concrete enough that a chapter could be outlined from it."""


def toc_step1_max_tokens(bullet_hi: int) -> int:
    return min(12000, max(1200, 800 + bullet_hi * 75))


def toc_step2_max_tokens(n_chapters: int) -> int:
    n = max(1, round(n_chapters))
    return min(32768, 512 + n * 100)


def build_research_messages(
    *,
    book_title: str,
    figure_name: str,
    intended_ages: str,
    guide_prompt: str,
    target_pages: int | None,
    target_chapters: int,
    draft_introduction_with_ai: bool,
) -> tuple[list[dict[str, str]], int]:
    audience_line = intended_audience_prompt_snippet(intended_ages)
    user_block = (
        f"Additional direction from the editor:\n{guide_prompt}" if guide_prompt.strip() else "No extra notes."
    )
    page_hint = (
        f"\nThe editor wants a book of roughly {target_pages} printed pages (editorial estimate; not exact pagination in the app). Plan chapter scope accordingly."
        if target_pages is not None
        else ""
    )
    lo, hi = life_events_bullet_range(target_chapters)
    chapter_budget = toc_step1_chapter_budget_narrative(
        target_chapters,
        draft_introduction_with_ai=draft_introduction_with_ai,
    )
    user_msg = f"""For a biographical book we are structuring in OpenBook.

Book title: {book_title}
Historical figure: {figure_name}
{audience_line}
{user_block}{page_hint}

{chapter_budget}

Task: list ONLY important events, periods, roles, and turning points in this person's life that could anchor those chapters. Use {lo}–{hi} short bullet lines (one event or theme per line), in rough chronological order. Focus on what historians and general encyclopedias typically emphasize. Do not include a table of contents — bullets only, no JSON."""
    messages = [
        {
            "role": "system",
            "content": (
                "You help plan biographies using well-established historical and public knowledge. You cannot browse the web. "
                "Prefer facts widely attested in reference works; if you are unsure, omit rather than invent. The editor states "
                "an intended readership (ages/audience): weight which life themes matter for that audience (depth vs. skim, emphasis) "
                "without inventing facts. The editor states how many NEW chapters will follow; scale the breadth and granularity of "
                "your bullet list to that count so each chapter can be grounded without invention or padding. Reply in plain text only."
            ),
        },
        {"role": "user", "content": user_msg},
    ]
    return messages, toc_step1_max_tokens(hi)


def build_toc_json_messages(
    *,
    book_title: str,
    figure_name: str,
    intended_ages: str,
    guide_prompt: str,
    target_pages: int | None,
    target_chapters: int,
    life_events_text: str,
) -> tuple[list[dict[str, str]], int]:
    audience_line = intended_audience_prompt_snippet(intended_ages)
    user_block = (
        f"Additional direction from the editor:\n{guide_prompt}" if guide_prompt.strip() else "No extra notes."
    )
    page_hint = (
        f"\nThe editor wants a book of roughly {target_pages} printed pages (editorial estimate; not exact pagination in the app). Plan chapter scope accordingly."
        if target_pages is not None
        else ""
    )
    events_for_prompt = life_events_text.strip()[:6000]
    n = clamp_target_new_chapters(target_chapters)
    user_msg = f"""You are building the table of contents for a Wikipedia-style biographical book.

Book title: {book_title}
Historical figure: {figure_name}
{audience_line}
{user_block}{page_hint}

Below is a research pass listing important events and themes in this person's life. Your chapters must reflect these events (merge or split bullets into coherent sections; you do not need one chapter per bullet).

--- Life events and themes ---
{events_for_prompt}
--- end ---

Output format — follow exactly:
- Write exactly {n} lines (no more, no fewer). Each line is ONE compact JSON object and nothing else on that line.
- Each object MUST have exactly: "title" (string) and "slug" (string). No summary, no other fields.
- slug: lowercase, a-z 0-9 and hyphens only, no spaces, matches the chapter title (e.g. title "Early life" → slug "early-life"). Each slug must differ from the others.
- Do NOT wrap lines in [ ]. One object per line. No trailing commas.

Example:
{{"title":"Early life and education","slug":"early-life-and-education"}}
{{"title":"Political rise","slug":"political-rise"}}"""
    messages = [
        {
            "role": "system",
            "content": (
                'You output JSON Lines (NDJSON) only: one JSON object per line, no markdown, no prose, no array brackets []. '
                'Each object uses EXACTLY two keys: "title" and "slug". Slug = lowercase words with hyphens, URL-safe, unique per line, '
                "derived from the title wording. No other keys. Never duplicate keys inside an object. Chapter titles should suit the "
                "intended readership (ages/audience) given in the user message — clear and appropriate, not gratuitously graphic."
            ),
        },
        {"role": "user", "content": user_msg},
    ]
    return messages, toc_step2_max_tokens(n)
