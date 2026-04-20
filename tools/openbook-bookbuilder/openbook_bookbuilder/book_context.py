"""Build book context markdown for chapter prompts (book-context.ts)."""

from __future__ import annotations

from openbook_bookbuilder.constants import MAX_BOOK_CONTEXT_CHARS


def intended_audience_prompt_snippet(intended_ages: str) -> str:
    t = intended_ages.strip()[:255]
    if t:
        return (
            f"Intended readership (ages / audience): {t}. Match vocabulary, sentence length, "
            "and how explicitly you treat difficult themes to this audience while staying accurate and neutral."
        )
    return (
        "Intended readership (ages / audience): not set on this book — use clear, neutral prose "
        "suitable for a general adult reader unless the editor specifies otherwise in their notes."
    )


def book_context_prompt_instruction() -> str:
    return (
        "Below is structured context from this book (Markdown). "
        "For shorter books, every chapter’s latest text appears in order, separated by ---. "
        "For longer books, only the **table of contents** (all titles) and the **full text of the last chapter** "
        "appear so the prompt fits the model’s context limit. "
        "The chapter to generate is marked; it is your ONLY output target. Stay consistent with names, dates, "
        "and tone in this context, but do not copy other chapters verbatim."
    )


def _build_full(sections: list[dict[str, str]], current_slug: str) -> str:
    parts: list[str] = []
    for s in sections:
        is_current = s["slug"] == current_slug
        marker = (
            "\n\n_(**This is the chapter you are generating.** Your output must be only this chapter’s Markdown, "
            "not the others.)_\n"
            if is_current
            else ""
        )
        body = s.get("body", "").strip() or "_(empty)_"
        parts.append(f"## {s['title']}{marker}\n\n{body}\n")
    return "\n---\n\n".join(parts)


def _build_compact(sections: list[dict[str, str]], current_slug: str, max_total: int) -> str:
    if not sections:
        return "_(No sections in this book.)_"

    toc_lines = []
    for i, s in enumerate(sections):
        mark = " ← **chapter to generate**" if s["slug"] == current_slug else ""
        toc_lines.append(f"{i + 1}. **{s['title']}** (`{s['slug']}`){mark}")
    toc = "\n".join(toc_lines)

    last = sections[-1]
    is_current = last["slug"] == current_slug
    marker = (
        "\n\n_(**This is the chapter you are generating.** Your output must be only this chapter’s Markdown.)_\n"
        if is_current
        else ""
    )

    header = (
        "_The manuscript is long, so this context lists every chapter title and includes the **full text of only "
        "the last chapter** (latest in the book order) for tone and continuity. Rely on reference snippets and "
        "your guides for facts from earlier periods._\n\n"
        "## Table of contents\n"
        f"{toc}\n\n---\n\n## Last chapter: {last['title']}{marker}"
    )

    body = last.get("body", "").strip() or "_(empty)_"
    budget = max(512, max_total - len(header) - 80)
    body_out = body if len(body) <= budget else body[:budget] + "\n\n[... last chapter truncated for length ...]"

    return f"{header}{body_out}\n"


def build_book_context_markdown(
    sections: list[dict[str, str]],
    current_section_slug: str,
) -> str:
    full = _build_full(sections, current_section_slug)
    if len(full) <= MAX_BOOK_CONTEXT_CHARS:
        out = full
    else:
        out = _build_compact(sections, current_section_slug, MAX_BOOK_CONTEXT_CHARS)
    if len(out) > MAX_BOOK_CONTEXT_CHARS:
        out = out[:MAX_BOOK_CONTEXT_CHARS] + "\n\n[... book context truncated for length ...]"
    return out
