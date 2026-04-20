"""Streamlit GUI: book metadata, Ollama TOC + chapters, export BookDraftPayloadV1 JSON."""

from __future__ import annotations

import json
import re
from typing import Any

import pandas as pd
import streamlit as st

from openbook_bookbuilder.book_context import (
    book_context_prompt_instruction,
    build_book_context_markdown,
    intended_audience_prompt_snippet,
)
from openbook_bookbuilder.constants import (
    BOOK_DRAFT_PAYLOAD_VERSION,
    BOOK_LOCALE_OPTIONS,
    INTENDED_AUDIENCE_OPTIONS,
    MAX_AUTO_WIZARD_PUBLISH_SECTIONS,
)
from openbook_bookbuilder.llm_prompts import (
    build_research_messages,
    build_toc_json_messages,
    clamp_target_new_chapters,
)
from openbook_bookbuilder.ollama_client import chat_completion, list_models
from openbook_bookbuilder.slugify import is_reserved_slug, slugify, unique_slug_from_preferred
from openbook_bookbuilder.toc_parse import parse_toc_from_llm_text

WORDS_PER_PAGE = 275


def _strip_outer_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:markdown|md)?\s*", "", t, flags=re.I)
        t = re.sub(r"\s*```$", "", t).strip()
    return t


def _init_state() -> None:
    defaults: dict[str, Any] = {
        "title": "",
        "figure_name": "",
        "intended_ages": "adults",
        "default_locale": "en",
        "country": "",
        "slug": "",
        "summary": "",
        "tags": "",
        "include_introduction": False,
        "target_chapters": 8,
        "target_pages": "",
        "ollama_base": "http://127.0.0.1:11434",
        "model": "",
        "guide_prompt": "",
        "temperature": 0.35,
        "toc_temperature": 0.12,
        "toc_rows": [],
        "chapters": [],
        "raw_research": "",
        "raw_toc": "",
        # Bump when chapter bodies are replaced (bulk generate, apply TOC, regenerate);
        # otherwise Streamlit keeps empty text_area state and ignores new bodies.
        "chapter_body_widget_epoch": 0,
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


def _bump_chapter_body_widget_epoch() -> None:
    st.session_state.chapter_body_widget_epoch = (
        int(st.session_state.get("chapter_body_widget_epoch", 0)) + 1
    )


def _ordered_sections_for_chapters(
    include_introduction: bool,
    toc_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    if include_introduction:
        rows.append({"slug": "introduction", "title": "Introduction", "body": ""})
    for r in toc_rows:
        rows.append({"slug": r["slug"], "title": r["title"], "body": ""})
    return rows


def _validate_toc_rows(rows: list[dict[str, str]]) -> str | None:
    seen: set[str] = set()
    for r in rows:
        title = (r.get("title") or "").strip()[:120]
        slug_raw = (r.get("slug") or "").strip()
        slug = slugify(slug_raw or title)
        if not title or not slug:
            return "Each row needs a non-empty title and a valid slug."
        if is_reserved_slug(slug):
            return f"Reserved slug not allowed: {slug}"
        lo = slug.lower()
        if lo in seen:
            return f"Duplicate slug: {slug}"
        seen.add(lo)
    return None


def _build_payload() -> dict[str, Any]:
    chapters_out: list[dict[str, str]] = []
    for c in st.session_state.chapters:
        chapters_out.append(
            {
                "slug": slugify((c.get("slug") or "").strip() or c.get("title", "")),
                "title": (c.get("title") or "").strip()[:120],
                "body": c.get("body") or "",
            }
        )
    return {
        "v": BOOK_DRAFT_PAYLOAD_VERSION,
        "title": st.session_state.title,
        "figureName": st.session_state.figure_name,
        "intendedAges": st.session_state.intended_ages,
        "country": st.session_state.country.strip(),
        "summary": st.session_state.summary,
        "slug": st.session_state.slug.strip(),
        "tags": st.session_state.tags,
        "defaultLocale": st.session_state.default_locale,
        "includeIntroduction": bool(st.session_state.include_introduction),
        "figureVerifiedKind": "",
        "figureVerifiedKey": "",
        "chapters": chapters_out if chapters_out else None,
    }


def run_streamlit() -> None:
    st.set_page_config(page_title="OpenBook — local book builder", layout="wide")
    _init_state()

    st.title("OpenBook local book builder")
    st.caption("Draft with Ollama, then export JSON for import on the website.")

    tab_setup, tab_model, tab_prompt, tab_toc, tab_chapters, tab_export = st.tabs(
        ["Setup", "Model", "Prompt", "TOC", "Chapters", "Export"]
    )

    with tab_setup:
        st.session_state.title = st.text_input("Book title", value=st.session_state.title)
        st.session_state.figure_name = st.text_input(
            "Historical figure (canonical name)",
            value=st.session_state.figure_name,
        )
        st.session_state.intended_ages = st.selectbox(
            "Intended ages / audience",
            options=list(INTENDED_AUDIENCE_OPTIONS),
            index=list(INTENDED_AUDIENCE_OPTIONS).index(st.session_state.intended_ages)
            if st.session_state.intended_ages in INTENDED_AUDIENCE_OPTIONS
            else 7,
        )
        locale_codes = [c for c, _ in BOOK_LOCALE_OPTIONS]
        labels_by_code = dict(BOOK_LOCALE_OPTIONS)
        lix = (
            locale_codes.index(st.session_state.default_locale)
            if st.session_state.default_locale in locale_codes
            else 0
        )
        st.session_state.default_locale = st.selectbox(
            "Primary language",
            options=locale_codes,
            index=lix,
            format_func=lambda c: f"{c} — {labels_by_code.get(c, c)}",
        )
        st.session_state.country = st.text_input(
            "Country / region (optional)",
            value=st.session_state.country,
            max_chars=255,
        )
        st.session_state.slug = st.text_input(
            "URL slug (optional)",
            value=st.session_state.slug,
            help="Leave empty to derive on the website from figure + title.",
        )
        st.session_state.summary = st.text_area("Short summary (optional)", value=st.session_state.summary)
        st.session_state.tags = st.text_input(
            "Tags (optional, comma-separated)",
            value=st.session_state.tags,
        )
        st.session_state.include_introduction = st.checkbox(
            "Include Introduction section (AI-drafted when you generate chapters)",
            value=st.session_state.include_introduction,
        )
        st.session_state.target_chapters = st.number_input(
            "Target biography chapters (TOC size)",
            min_value=1,
            max_value=2000,
            value=int(st.session_state.target_chapters),
        )
        tp = st.text_input(
            "Target printed pages (optional, for length hints)",
            value=st.session_state.target_pages,
            placeholder="e.g. 40",
        )
        st.session_state.target_pages = tp
        st.session_state.temperature = st.slider(
            "Chapter generation temperature", 0.0, 1.5, float(st.session_state.temperature), 0.05
        )

    with tab_model:
        st.session_state.ollama_base = st.text_input("Ollama base URL", value=st.session_state.ollama_base)
        if st.button("Refresh model list"):
            try:
                models = list_models(st.session_state.ollama_base)
                st.session_state["_ollama_models"] = models
            except Exception as e:  # noqa: BLE001
                st.error(f"Could not list models: {e}")
        models = st.session_state.get("_ollama_models") or []
        if not models:
            st.info('Click "Refresh model list" after Ollama is running.')
        else:
            idx = 0
            if st.session_state.model in models:
                idx = models.index(st.session_state.model)
            st.session_state.model = st.selectbox("Model", options=models, index=idx)

    with tab_prompt:
        st.session_state.guide_prompt = st.text_area(
            "Guide prompt (editorial direction)",
            value=st.session_state.guide_prompt,
            height=180,
            placeholder="e.g. Focus on scientific work; keep tone neutral and encyclopedic.",
        )

    with tab_toc:
        st.session_state.toc_temperature = st.slider(
            "TOC JSON step temperature", 0.0, 1.0, float(st.session_state.toc_temperature), 0.01
        )
        if st.button("Generate TOC (2-step: life events → chapter list)", type="primary"):
            if not st.session_state.model:
                st.error("Select a model in the Model tab.")
            elif not st.session_state.title.strip() or not st.session_state.figure_name.strip():
                st.error("Book title and historical figure are required.")
            else:
                try:
                    target_pages_int: int | None = None
                    if str(st.session_state.target_pages).strip():
                        target_pages_int = max(1, min(500, int(str(st.session_state.target_pages).strip())))

                    msgs1, max1 = build_research_messages(
                        book_title=st.session_state.title.strip(),
                        figure_name=st.session_state.figure_name.strip(),
                        intended_ages=st.session_state.intended_ages,
                        guide_prompt=st.session_state.guide_prompt,
                        target_pages=target_pages_int,
                        target_chapters=int(st.session_state.target_chapters),
                        draft_introduction_with_ai=bool(st.session_state.include_introduction),
                    )
                    with st.spinner("Step 1: life events…"):
                        research = chat_completion(
                            st.session_state.ollama_base,
                            st.session_state.model,
                            msgs1,
                            temperature=st.session_state.temperature,
                            max_tokens=max1,
                        )
                    st.session_state.raw_research = research
                    life = research.strip()
                    if len(life) < 40:
                        st.error("Model returned too little text for life events. Check raw response below.")
                    else:
                        msgs2, max2 = build_toc_json_messages(
                            book_title=st.session_state.title.strip(),
                            figure_name=st.session_state.figure_name.strip(),
                            intended_ages=st.session_state.intended_ages,
                            guide_prompt=st.session_state.guide_prompt,
                            target_pages=target_pages_int,
                            target_chapters=int(st.session_state.target_chapters),
                            life_events_text=life,
                        )
                        with st.spinner("Step 2: table of contents…"):
                            toc_raw = chat_completion(
                                st.session_state.ollama_base,
                                st.session_state.model,
                                msgs2,
                                temperature=st.session_state.toc_temperature,
                                max_tokens=max2,
                            )
                        st.session_state.raw_toc = toc_raw
                        parsed = parse_toc_from_llm_text(toc_raw)
                        n = clamp_target_new_chapters(int(st.session_state.target_chapters))
                        reserved = {"introduction"} if st.session_state.include_introduction else set()
                        filtered = [p for p in parsed if p["slug"].lower() not in reserved][:n]
                        if not filtered:
                            st.error("Could not parse usable TOC rows. See raw TOC below.")
                        else:
                            st.session_state.toc_rows = filtered
                            st.success(f"Parsed {len(filtered)} chapters.")
                except Exception as e:  # noqa: BLE001
                    st.exception(e)

        with st.expander("Raw life-events response"):
            st.text_area("research", value=st.session_state.raw_research, height=200, key="raw_research_view")
        with st.expander("Raw TOC response"):
            st.text_area("toc", value=st.session_state.raw_toc, height=200, key="raw_toc_view")

        if st.session_state.toc_rows:
            st.subheader("Edit table of contents")
            df = pd.DataFrame(st.session_state.toc_rows)
            edited = st.data_editor(
                df,
                num_rows="dynamic",
                use_container_width=True,
                column_config={
                    "title": st.column_config.TextColumn("Title", required=True, max_chars=120),
                    "slug": st.column_config.TextColumn("Slug", required=True),
                },
            )
            rows = edited.to_dict("records")
            clean: list[dict[str, str]] = []
            taken: set[str] = set()
            for r in rows:
                if not isinstance(r, dict):
                    continue
                title = str(r.get("title", "")).strip()[:120]
                if not title:
                    continue
                slug = unique_slug_from_preferred(
                    str(r.get("slug", "")).strip() or None,
                    title,
                    taken,
                )
                if slug:
                    taken.add(slug.lower())
                    clean.append({"title": title, "slug": slug})
            st.session_state.toc_rows = clean
            err = _validate_toc_rows(clean)
            if err:
                st.warning(err)
            if st.button("Apply TOC to chapter list (reset bodies)"):
                st.session_state.chapters = _ordered_sections_for_chapters(
                    st.session_state.include_introduction,
                    clean,
                )
                _bump_chapter_body_widget_epoch()
                st.success(f"Chapter list set to {len(st.session_state.chapters)} sections.")

    with tab_chapters:
        if not st.session_state.chapters:
            st.info('Generate and edit TOC, then click "Apply TOC to chapter list".')
        else:
            n = len(st.session_state.chapters)
            if n > MAX_AUTO_WIZARD_PUBLISH_SECTIONS:
                st.error(f"Too many sections ({n}). Max is {MAX_AUTO_WIZARD_PUBLISH_SECTIONS}.")

            target_pages_int: int | None = None
            if str(st.session_state.target_pages).strip():
                try:
                    target_pages_int = max(1, min(500, int(str(st.session_state.target_pages).strip())))
                except ValueError:
                    target_pages_int = None
            total_sections = n
            words_per_chapter = (
                round((target_pages_int * WORDS_PER_PAGE) / total_sections)
                if target_pages_int and total_sections > 0
                else None
            )
            length_line = (
                f"Approximate book length target: about {target_pages_int} printed pages (editorial estimate). "
                f"For this chapter, aim for roughly {words_per_chapter} words so sections stay balanced. "
                "This is guidance only."
                if words_per_chapter is not None
                else "Use depth appropriate to the chapter title and audience; keep proportions similar across sections."
            )

            if st.button("Generate all chapter bodies", type="primary"):
                if not st.session_state.model:
                    st.error("Select a model.")
                else:
                    guide = (
                        st.session_state.guide_prompt.strip()
                        or "Write a thorough, neutral biographical section suitable for a wiki-style book. "
                        "Use Markdown (headings, lists where helpful)."
                    )
                    audience_line = intended_audience_prompt_snippet(st.session_state.intended_ages)
                    ordered = [dict(c) for c in st.session_state.chapters]
                    progress = st.progress(0.0)
                    for i, sec in enumerate(ordered):
                        slug = sec["slug"]
                        intro_note = ""
                        if slug == "introduction":
                            intro_note = (
                                "\nThis section is the book introduction (not a biography chapter). Orient the reader: "
                                "who the subject is, why they matter, and how later chapters are organized—stay concise "
                                "and avoid duplicating detailed life narrative that belongs in the following chapters.\n"
                            )
                        ctx = build_book_context_markdown(ordered, slug)
                        user_msg = f"""Book title: "{st.session_state.title.strip()}"
{audience_line}
Historical figure (subject): {st.session_state.figure_name.strip()}

{book_context_prompt_instruction()}

--- BEGIN BOOK CONTEXT ---
{ctx}
--- END BOOK CONTEXT ---

Chapter you are writing: "{sec['title']}" (URL slug: {slug})

Length: {length_line}

Editor guidance — follow closely:
{guide}{intro_note}
Produce the full Markdown body for this chapter only."""
                        messages = [
                            {
                                "role": "system",
                                "content": (
                                    "You write factual, neutral biographical encyclopedia prose in Markdown. "
                                    "Output only the chapter body: no preamble, no ‘Here is the chapter’, "
                                    "no code fences around the whole thing. Always honor the intended readership "
                                    "(ages/audience) described in the user message when choosing vocabulary and "
                                    "how you present sensitive material."
                                ),
                            },
                            {"role": "user", "content": user_msg},
                        ]
                        try:
                            text = chat_completion(
                                st.session_state.ollama_base,
                                st.session_state.model,
                                messages,
                                temperature=st.session_state.temperature,
                                max_tokens=8192,
                            )
                            text = _strip_outer_fence(text).strip()
                            sec["body"] = text
                            ordered[i]["body"] = text
                        except Exception as e:  # noqa: BLE001
                            st.error(f"Chapter {slug}: {e}")
                            break
                        progress.progress((i + 1) / len(ordered))
                    progress.empty()
                    st.session_state.chapters = ordered
                    _bump_chapter_body_widget_epoch()
                    st.success("Chapter generation finished (check bodies below).")

            epoch = int(st.session_state.get("chapter_body_widget_epoch", 0))
            for idx, sec in enumerate(st.session_state.chapters):
                with st.expander(f"{sec['title']} (`{sec['slug']}`)"):
                    wkey = f"ch_body_e{epoch}_{idx}_{sec['slug']}"
                    if wkey not in st.session_state:
                        st.session_state[wkey] = sec.get("body", "") or ""
                    body = st.text_area(
                        "Markdown body",
                        height=320,
                        key=wkey,
                    )
                    sec["body"] = body
                    if st.button(f"Regenerate: {sec['title']}", key=f"regen_{idx}"):
                        if not st.session_state.model:
                            st.error("Select a model.")
                        else:
                            guide = (
                                st.session_state.guide_prompt.strip()
                                or "Write a thorough, neutral biographical section suitable for a wiki-style book."
                            )
                            audience_line = intended_audience_prompt_snippet(st.session_state.intended_ages)
                            ordered = [dict(c) for c in st.session_state.chapters]
                            slug = sec["slug"]
                            intro_note = ""
                            if slug == "introduction":
                                intro_note = (
                                    "\nThis section is the book introduction (not a biography chapter).\n"
                                )
                            ctx = build_book_context_markdown(ordered, slug)
                            user_msg = f"""Book title: "{st.session_state.title.strip()}"
{audience_line}
Historical figure (subject): {st.session_state.figure_name.strip()}

{book_context_prompt_instruction()}

--- BEGIN BOOK CONTEXT ---
{ctx}
--- END BOOK CONTEXT ---

Chapter you are writing: "{sec['title']}" (URL slug: {slug})

Length: {length_line}

Editor guidance — follow closely:
{guide}{intro_note}
Produce the full Markdown body for this chapter only."""
                            messages = [
                                {
                                    "role": "system",
                                    "content": (
                                        "You write factual, neutral biographical encyclopedia prose in Markdown. "
                                        "Output only the chapter body: no preamble, no code fences around the whole thing."
                                    ),
                                },
                                {"role": "user", "content": user_msg},
                            ]
                            try:
                                text = chat_completion(
                                    st.session_state.ollama_base,
                                    st.session_state.model,
                                    messages,
                                    temperature=st.session_state.temperature,
                                    max_tokens=8192,
                                )
                                sec["body"] = _strip_outer_fence(text).strip()
                                st.session_state.chapters[idx]["body"] = sec["body"]
                                _bump_chapter_body_widget_epoch()
                                st.rerun()
                            except Exception as e:  # noqa: BLE001
                                st.error(str(e))

    with tab_export:
        payload = _build_payload()
        raw = json.dumps(payload, indent=2, ensure_ascii=False)
        st.download_button(
            "Download book-draft.json",
            data=raw.encode("utf-8"),
            file_name="book-draft.json",
            mime="application/json",
        )
        st.json(payload)


def main() -> None:
    run_streamlit()


if __name__ == "__main__":
    run_streamlit()
