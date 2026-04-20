# openbook-bookbuilder

Local GUI to draft a biography-style book with **Ollama**, then export JSON you can **import** into [openBook](https://github.com/ifryed/openBook).

## Requirements

- Python 3.11+
- [Ollama](https://ollama.com/) running locally (default `http://127.0.0.1:11434`) with at least one chat model pulled

## Install

```bash
cd tools/openbook-bookbuilder
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

## Run

```bash
# from this directory, with venv activated
openbook-bookbuilder
# or:
streamlit run openbook_bookbuilder/app.py
```

Open the URL Streamlit prints (usually `http://localhost:8501`).

## Workflow

1. **Setup** — Book title, historical figure, intended ages / audience, primary language, optional country, slug, summary, tags, optional Introduction section, target chapter count, optional page target.
2. **Model** — Refresh the list from Ollama and pick a model.
3. **Prompt** — Editorial “guide prompt” (tone, emphasis, reading level hints).
4. **TOC** — Generate a two-step table of contents (life-events bullets → chapter JSON), then edit rows in the table and **Apply TOC to chapter list**.
5. **Chapters** — Generate all bodies or regenerate per chapter; edit Markdown in the text areas.
6. **Export** — Download `book-draft.json`.

## Import on the website

After signing in, open **New draft → Import book JSON** (or go to `/drafts/import/book` on your locale prefix, e.g. `/en/drafts/import/book` if your app uses a locale segment).

The file format matches `BookDraftPayloadV1` in the site codebase: [`src/lib/content-draft-payload.ts`](../../src/lib/content-draft-payload.ts) (`v: 1`, camelCase fields, optional `chapters` array of `{ slug, title, body }`). Complete **historical figure verification** on the draft edit screen before publishing.

### Field vocabularies (must match the site)

- **Intended ages / audience**: `0-3`, `3-8`, `5-9`, `6-10`, `8-12`, `teens`, `young adults`, `adults` — see `src/lib/intended-audience.ts`.
- **Primary language**: ISO codes allowed on the site — see `BOOK_LOCALE_OPTIONS` in `src/lib/book-locales.ts` (mirrored in `openbook_bookbuilder/constants.py`).

## Development

Slug rules mirror `src/lib/slug.ts`. Chapter and TOC limits mirror `src/lib/book-limits.ts` (`MAX_AUTO_WIZARD_PUBLISH_SECTIONS`).
