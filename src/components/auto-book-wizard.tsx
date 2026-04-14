"use client";

import {
  assertAutoWizardPublishPreconditions,
  publishAutoWizardBook,
} from "@/app/actions/books";
import { withLangQuery } from "@/lib/book-locales";
import { MAX_LLM_TOC_SECTIONS } from "@/lib/book-limits";
import { fetchDraftReferenceContext } from "@/app/actions/references";
import {
  bookContextPromptInstruction,
  buildBookContextMarkdown,
  intendedAudiencePromptSnippet,
} from "@/lib/book-context";
import { parseTocFromLlmText, type TocSuggestion } from "@/lib/llm-toc-parse";
import {
  lifeEventsBulletRange,
  tocStep1ChapterBudgetNarrative,
  tocStep1MaxTokens,
  tocStep2MaxTokens,
} from "@/lib/llm-toc-prompts";
import { WEBLLM_CHAT_OPTIONS, WEBLLM_MODEL } from "@/lib/webllm-model";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { BookPrimaryLanguageSelect } from "@/components/book-primary-language-select";
import { FigureNameField } from "@/components/figure-name-field";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";
import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_BIO_CHAPTERS = 1;
const WORDS_PER_PAGE = 275;

type ChapterLogEntry = {
  slug: string;
  title: string;
  status: "pending" | "running" | "ok" | "error";
  body?: string;
  error?: string;
};

type Phase =
  | "idle"
  | "loading_model"
  | "toc_research"
  | "toc_json"
  | "chapters"
  | "publishing"
  | "done"
  | "error";

type DraftOrderRow = { slug: string; title: string; body: string };

export function AutoBookWizard() {
  const formRef = useRef<HTMLFormElement>(null);
  const engineRef = useRef<MLCEngine | null>(null);
  const [figureOk, setFigureOk] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bookSlug, setBookSlug] = useState<string | null>(null);
  const [publishedDefaultLocale, setPublishedDefaultLocale] = useState<
    string | null
  >(null);
  const [rawResearch, setRawResearch] = useState<string | null>(null);
  const [rawToc, setRawToc] = useState<string | null>(null);
  const [tocRows, setTocRows] = useState<TocSuggestion[]>([]);
  const [chapterLog, setChapterLog] = useState<ChapterLogEntry[]>([]);
  const [publishableDraft, setPublishableDraft] = useState<
    DraftOrderRow[] | null
  >(null);
  const [useReferenceLookup, setUseReferenceLookup] = useState(true);

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      engineRef.current = null;
      void e?.unload();
    };
  }, []);

  const runPipeline = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    if (!figureOk) {
      setError(
        "Confirm the historical figure with Check name → pick → Use selected person.",
      );
      return;
    }

    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator === "undefined" || !nav.gpu) {
      setError(
        "WebGPU is not available. Use a recent Chrome or Edge on desktop with a capable GPU.",
      );
      return;
    }

    const fd = new FormData(form);
    /** Creates the Introduction section; wizard drafts it like other chapters. */
    const draftIntroductionWithAi = fd.get("includeIntroduction") === "on";
    const targetChaptersRaw = Number(
      fd.get("targetChapters")?.toString() ?? "8",
    );
    const targetChapters = Math.min(
      MAX_LLM_TOC_SECTIONS,
      Math.max(
        MIN_BIO_CHAPTERS,
        Number.isFinite(targetChaptersRaw) ? targetChaptersRaw : 8,
      ),
    );
    const pagesRaw = fd.get("targetPages")?.toString().trim() ?? "";
    const targetPages =
      pagesRaw.length > 0
        ? Math.max(1, Math.min(500, Number(pagesRaw) || 0))
        : null;
    const guidePrompt = fd.get("guidePrompt")?.toString().trim() ?? "";
    const userBlock = guidePrompt
      ? `Additional direction from the editor:\n${guidePrompt}`
      : "No extra notes.";
    const pageHint =
      targetPages !== null
        ? `\nThe editor wants a book of roughly ${targetPages} printed pages (editorial estimate; not exact pagination in the app). Plan chapter scope accordingly.`
        : "";

    setError(null);
    setRawResearch(null);
    setRawToc(null);
    setTocRows([]);
    setChapterLog([]);
    setBookSlug(null);
    setPublishableDraft(null);

    const bookTitle = fd.get("title")?.toString().trim() ?? "";
    const figureName = fd.get("figureName")?.toString().trim() ?? "";
    const intendedAges = fd.get("intendedAges")?.toString().trim() ?? "";
    const audienceLine = intendedAudiencePromptSnippet(intendedAges);

    const { lo: bulletLo, hi: bulletHi } =
      lifeEventsBulletRange(targetChapters);
    const chapterBudgetBlock = tocStep1ChapterBudgetNarrative(targetChapters, {
      existingSectionNote: draftIntroductionWithAi
        ? "The final book will include an AI-written Introduction plus the biography chapters from the next step; these bullets support only those biography chapters (not the introduction)."
        : "These bullets support only the new biography chapters in the next step.",
    });

    try {
      setPhase("loading_model");
      setProgress(
        "Loading WebLLM — Llama 3.1 8B (first run may download several GB)…",
      );
      if (!engineRef.current) {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        const engine = await CreateMLCEngine(
          WEBLLM_MODEL,
          {
            initProgressCallback: (report) => {
              setProgress(
                `${report.text} (${Math.round(report.progress * 100)}%)`,
              );
            },
          },
          WEBLLM_CHAT_OPTIONS,
        );
        engineRef.current = engine;
      }

      const engine = engineRef.current!;

      setPhase("toc_research");
      setProgress("Step 1 of 2: outlining important life events…");
      const researchCompletion = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You help plan biographies using well-established historical and public knowledge. You cannot browse the web. Prefer facts widely attested in reference works; if you are unsure, omit rather than invent. The editor states an intended readership (ages/audience): weight which life themes matter for that audience (depth vs. skim, emphasis) without inventing facts. The editor states how many NEW chapters will follow; scale the breadth and granularity of your bullet list to that count so each chapter can be grounded without invention or padding. Reply in plain text only.",
          },
          {
            role: "user",
            content: `For a biographical book we are structuring in OpenBook.

Book title: ${bookTitle}
Historical figure: ${figureName}
${audienceLine}
${userBlock}${pageHint}

${chapterBudgetBlock}

Task: list ONLY important events, periods, roles, and turning points in this person's life that could anchor those chapters. Use ${bulletLo}–${bulletHi} short bullet lines (one event or theme per line), in rough chronological order. Focus on what historians and general encyclopedias typically emphasize. Do not include a table of contents — bullets only, no JSON.`,
          },
        ],
        temperature: 0.35,
        max_tokens: tocStep1MaxTokens(bulletHi),
      });

      const researchText =
        researchCompletion.choices[0]?.message?.content ?? "";
      setRawResearch(researchText);
      const lifeEventsText = researchText.trim();
      if (!lifeEventsText || lifeEventsText.length < 40) {
        setError(
          "The model did not produce enough life-event notes. Open the raw response below and try again.",
        );
        setPhase("error");
        setProgress("");
        return;
      }

      const eventsForPrompt = lifeEventsText.slice(0, 6000);

      setPhase("toc_json");
      setProgress("Step 2 of 2: building table of contents…");
      const tocCompletion = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              'You output JSON Lines (NDJSON) only: one JSON object per line, no markdown, no prose, no array brackets []. Each object uses EXACTLY two keys: "title" and "slug". Slug = lowercase words with hyphens, URL-safe, unique per line, derived from the title wording. No other keys. Never duplicate keys inside an object. Chapter titles should suit the intended readership (ages/audience) given in the user message — clear and appropriate, not gratuitously graphic.',
          },
          {
            role: "user",
            content: `You are building the table of contents for a Wikipedia-style biographical book.

Book title: ${bookTitle}
Historical figure: ${figureName}
${audienceLine}
${userBlock}${pageHint}

Below is a research pass listing important events and themes in this person's life. Your chapters must reflect these events (merge or split bullets into coherent sections; you do not need one chapter per bullet).

--- Life events and themes ---
${eventsForPrompt}
--- end ---

Output format — follow exactly:
- Write exactly ${targetChapters} lines (no more, no fewer). Each line is ONE compact JSON object and nothing else on that line.
- Each object MUST have exactly: "title" (string) and "slug" (string). No summary, no other fields.
- slug: lowercase, a-z 0-9 and hyphens only, no spaces, matches the chapter title (e.g. title "Early life" → slug "early-life"). Each slug must differ from the others.
- Do NOT wrap lines in [ ]. One object per line. No trailing commas.

Example:
{"title":"Early life and education","slug":"early-life-and-education"}
{"title":"Political rise","slug":"political-rise"}`,
          },
        ],
        temperature: 0.12,
        max_tokens: tocStep2MaxTokens(targetChapters),
      });

      const tocText = tocCompletion.choices[0]?.message?.content ?? "";
      setRawToc(tocText);

      const parsed = parseTocFromLlmText(tocText);
      const reservedSlugs = draftIntroductionWithAi
        ? new Set<string>(["introduction"])
        : new Set<string>();
      let filtered = parsed.filter((p) => !reservedSlugs.has(p.slug.toLowerCase()));
      filtered = filtered.slice(0, targetChapters);

      if (filtered.length === 0) {
        setError(
          "The model did not return usable TOC rows. Check raw responses below.",
        );
        setPhase("error");
        setProgress("");
        return;
      }

      setTocRows(filtered);

      const ordered: DraftOrderRow[] = [];
      if (draftIntroductionWithAi) {
        ordered.push({
          slug: "introduction",
          title: "Introduction",
          body: "",
        });
      }
      for (const row of filtered) {
        ordered.push({
          slug: row.slug,
          title: row.title,
          body: "",
        });
      }

      const preflight = await assertAutoWizardPublishPreconditions(
        ordered.length,
      );
      if ("error" in preflight) {
        setError(preflight.error);
        setPhase("error");
        setProgress("");
        return;
      }

      const totalSections = ordered.length;
      const wordsPerChapter =
        targetPages !== null && totalSections > 0
          ? Math.round((targetPages * WORDS_PER_PAGE) / totalSections)
          : null;
      const lengthLine =
        wordsPerChapter !== null
          ? `Approximate book length target: about ${targetPages} printed pages (editorial estimate). For this chapter, aim for roughly ${wordsPerChapter} words so sections stay balanced. This is guidance only.`
          : "Use depth appropriate to the chapter title and audience; keep proportions similar across sections.";

      setChapterLog(
        ordered.map((s) => ({
          slug: s.slug,
          title: s.title,
          status: "pending" as const,
        })),
      );

      setPhase("chapters");

      const guideBlock = guidePrompt
        ? guidePrompt
        : "Write a thorough, neutral biographical section suitable for a wiki-style book. Use Markdown (headings, lists where helpful).";

      for (let i = 0; i < ordered.length; i++) {
        const sec = ordered[i]!;
        const introDraftNote =
          sec.slug === "introduction"
            ? `\nThis section is the book introduction (not a biography chapter). Orient the reader: who the subject is, why they matter, and how later chapters are organized—stay concise and avoid duplicating detailed life narrative that belongs in the following chapters.\n`
            : "";
        setProgress(`Writing chapter ${i + 1} of ${ordered.length}: ${sec.title}…`);
        setChapterLog((prev) =>
          prev.map((row) =>
            row.slug === sec.slug ? { ...row, status: "running" } : row,
          ),
        );

        const sectionsForContext = ordered.map((s) => ({
          slug: s.slug,
          title: s.title,
          body: s.body,
        }));
        const bookContextMarkdown = buildBookContextMarkdown(
          sectionsForContext,
          sec.slug,
        );

        let referenceBlock = "";
        if (useReferenceLookup) {
          const refRes = await fetchDraftReferenceContext({
            guides: guidePrompt,
            figureName,
            sectionTitle: sec.title,
          });
          if (!refRes.ok) {
            setChapterLog((prev) =>
              prev.map((row) =>
                row.slug === sec.slug
                  ? { ...row, status: "error", error: refRes.error }
                  : row,
              ),
            );
            setError(refRes.error);
            setPhase("error");
            setProgress("");
            return;
          }
          referenceBlock = refRes.markdown.trim();
        }

        const systemParts = [
          "You write factual, neutral biographical encyclopedia prose in Markdown. Output only the chapter body: no preamble, no ‘Here is the chapter’, no code fences around the whole thing. Always honor the intended readership (ages/audience) described in the user message when choosing vocabulary and how you present sensitive material.",
        ];
        if (useReferenceLookup) {
          systemParts.push(
            "When REFERENCE SNIPPETS are present, prefer their concrete facts (names, dates, roles) over guesswork. If a detail is not in the book context or reference snippets, omit it or say it is uncertain rather than inventing. Encyclopedias and catalogs can be incomplete or wrong—stay conservative.",
          );
        }

        const referenceSection =
          referenceBlock.length > 0
            ? `\n--- REFERENCE SNIPPETS (external; verify important claims yourself) ---\n${referenceBlock}\n--- END REFERENCE SNIPPETS ---\n`
            : useReferenceLookup
              ? "\n(No matching Wikipedia/Wikidata/Open Library/Grokipedia snippets were returned. Rely on book context and guides; avoid fabricating specifics.)\n"
              : "";

        const completion = await engine.chat.completions.create({
          messages: [
            {
              role: "system",
              content: systemParts.join(" "),
            },
            {
              role: "user",
              content: `Book title: "${bookTitle}"
${audienceLine}
Historical figure (subject): ${figureName}

${bookContextPromptInstruction()}

--- BEGIN BOOK CONTEXT ---
${bookContextMarkdown}
--- END BOOK CONTEXT ---
${referenceSection}
Chapter you are writing: "${sec.title}" (URL slug: ${sec.slug})

Length: ${lengthLine}

Editor guidance — follow closely:
${guideBlock}${introDraftNote}
Produce the full Markdown body for this chapter only.`,
            },
          ],
          temperature: 0.35,
          max_tokens: 10000,
        });

        let text = completion.choices[0]?.message?.content?.trim() ?? "";
        if (!text) {
          const msg = "The model returned empty text for this chapter.";
          setChapterLog((prev) =>
            prev.map((row) =>
              row.slug === sec.slug
                ? { ...row, status: "error", error: msg }
                : row,
            ),
          );
          setError(msg);
          setPhase("error");
          setProgress("");
          return;
        }
        if (text.startsWith("```")) {
          text = text
            .replace(/^```(?:markdown|md)?\s*/i, "")
            .replace(/\s*```$/i, "");
        }
        text = text.trim();

        const draftRow = ordered.find((r) => r.slug === sec.slug);
        if (draftRow) draftRow.body = text;

        setChapterLog((prev) =>
          prev.map((row) =>
            row.slug === sec.slug
              ? { ...row, status: "ok", body: text }
              : row,
          ),
        );
      }

      setPublishableDraft(
        ordered.map((r) => ({
          slug: r.slug,
          title: r.title,
          body: r.body,
        })),
      );
      setPhase("done");
      setProgress("");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Wizard failed. Check the console.",
      );
      setPhase("error");
      setProgress("");
    }
  }, [figureOk, useReferenceLookup]);

  const publishDraft = useCallback(async () => {
    const form = formRef.current;
    if (!form || !publishableDraft?.length) return;
    if (!figureOk) {
      setError(
        "Confirm the historical figure with Check name → pick → Use selected person.",
      );
      return;
    }
    setError(null);
    setPhase("publishing");
    setProgress("Publishing book…");
    const fd = new FormData(form);
    const res = await publishAutoWizardBook(
      fd,
      JSON.stringify(publishableDraft),
    );
    if ("error" in res && res.error) {
      setError(res.error);
      setPhase("error");
      setProgress("");
      return;
    }
    if ("ok" in res && res.ok) {
      setBookSlug(res.slug);
      setPublishedDefaultLocale(res.defaultLocale);
      setPublishableDraft(null);
      setPhase("done");
      setProgress("");
    }
  }, [publishableDraft, figureOk]);

  const busy =
    phase !== "idle" &&
    phase !== "done" &&
    phase !== "error";

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        className="max-w-xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void runPipeline();
        }}
      >
        <label className="block text-sm font-medium">
          Book title
          <input
            name="title"
            required
            placeholder="e.g. The Life of Hypatia"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>

        <label htmlFor="auto-figureName" className="block text-sm font-medium">
          Historical figure (canonical name)
        </label>
        <FigureNameField
          id="auto-figureName"
          name="figureName"
          required
          placeholder="e.g. Hypatia of Alexandria"
          onValidityChange={setFigureOk}
        />

        <label htmlFor="auto-intendedAges" className="block text-sm font-medium">
          Intended ages / audience
        </label>
        <IntendedAudienceSelect
          id="auto-intendedAges"
          required
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="block text-xs text-muted">
          Used for filters and for local AI (reading level and tone).
        </span>

        <label
          htmlFor="auto-defaultLocale-search"
          className="block text-sm font-medium"
        >
          Primary language
        </label>
        <BookPrimaryLanguageSelect id="auto-defaultLocale" />
        <span className="mt-1 block text-xs text-muted">
          Add more languages from the book’s edit page after publishing.
        </span>

        <label className="block text-sm font-medium">
          Guide prompt
          <textarea
            name="guidePrompt"
            rows={4}
            placeholder="e.g. Focus on scientific work; keep personal life brief; emphasize primary sources where possible."
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="includeIntroduction" />
          <span>AI-drafted Introduction before the generated chapters.</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Biography chapters (TOC + drafting)
            <input
              name="targetChapters"
              type="number"
              min={MIN_BIO_CHAPTERS}
              defaultValue={8}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              At least {MIN_BIO_CHAPTERS}; no fixed max. Very large counts may hit the
              model or your revision rate limit. Optional Introduction is extra.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Target pages (optional)
            <input
              name="targetPages"
              type="number"
              min={1}
              max={500}
              placeholder="e.g. 40"
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              Rough editorial hint for the model (~{WORDS_PER_PAGE} words/page
              estimate), not real pagination.
            </span>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useReferenceLookup}
            onChange={(e) => setUseReferenceLookup(e.target.checked)}
          />
          Fetch reference snippets (Wikipedia, Wikidata, etc.) per chapter
        </label>

        <label className="block text-sm font-medium">
          Country / region (optional)
          <input
            name="country"
            maxLength={255}
            placeholder="e.g. India, France"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          URL slug (optional)
          <input
            name="slug"
            placeholder="hypatia"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm font-medium">
          Short summary (optional)
          <textarea
            name="summary"
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          Tags (optional, comma-separated)
          <input
            name="tags"
            placeholder="philosophy, ancient-greece"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>

        {error && phase === "error" ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {!figureOk ? (
          <p className="text-xs text-muted">
            Start stays disabled until the figure shows ✓ (Check name → pick →
            Use selected person).
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !figureOk}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {phase === "publishing"
            ? "Publishing…"
            : busy
              ? "Working…"
              : "Generate draft"}
        </button>
      </form>

      {progress ? (
        <p className="text-sm text-muted" aria-live="polite">
          {progress}
        </p>
      ) : null}

      {bookSlug ? (
        <p className="text-sm">
          Book:{" "}
          <Link
            href={withLangQuery(
              `/books/${bookSlug}`,
              publishedDefaultLocale ?? undefined,
            )}
            className="text-accent underline"
          >
            /books/{bookSlug}
          </Link>
        </p>
      ) : null}

      {(rawResearch !== null || rawToc !== null) && (
        <details className="rounded-lg border border-border bg-card/80 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Raw TOC model responses
          </summary>
          {rawResearch !== null ? (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted">Step 1 — life events</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 font-mono text-[11px]">
                {rawResearch}
              </pre>
            </div>
          ) : null}
          {rawToc !== null ? (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted">Step 2 — NDJSON</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 font-mono text-[11px]">
                {rawToc}
              </pre>
            </div>
          ) : null}
        </details>
      )}

      {tocRows.length > 0 ? (
        <div className="rounded-lg border border-border bg-card/80 p-3 text-sm">
          <p className="font-medium">Parsed table of contents</p>
          <ul className="mt-2 list-inside list-decimal text-xs">
            {tocRows.map((r) => (
              <li key={r.slug}>
                <span className="font-medium">{r.title}</span>{" "}
                <span className="font-mono text-muted">/{r.slug}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Not saved until you publish the book below.
          </p>
        </div>
      ) : null}

      {chapterLog.length > 0 ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Chapters</p>
          <ul className="space-y-2">
            {chapterLog.map((c) => (
              <li
                key={c.slug}
                className="rounded-md border border-border bg-card/80 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted">/{c.slug}</span>
                  <span
                    className={
                      c.status === "ok"
                        ? "text-xs text-green-700"
                        : c.status === "error"
                          ? "text-xs text-red-700"
                          : "text-xs text-muted"
                    }
                  >
                    {c.status}
                  </span>
                  {c.status === "ok" && bookSlug ? (
                    <Link
                      href={`/books/${bookSlug}/${c.slug}`}
                      className="text-xs text-accent underline"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
                {c.error ? (
                  <p className="mt-1 text-xs text-red-700">{c.error}</p>
                ) : null}
                {c.body ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted">
                      Generated Markdown
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 font-mono text-[11px]">
                      {c.body}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {publishableDraft &&
      !bookSlug &&
      (phase === "done" ||
        phase === "error" ||
        phase === "publishing") ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Draft is only in your browser. Publish to create the book on the server.
          </p>
          <button
            type="button"
            onClick={() => void publishDraft()}
            disabled={!figureOk || phase === "publishing"}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {phase === "publishing" ? "Publishing…" : "Publish book"}
          </button>
        </div>
      ) : null}

      {phase === "done" && bookSlug ? (
        <p className="text-sm">
          Published.{" "}
          <Link href={`/books/${bookSlug}`} className="text-accent underline">
            Open book
          </Link>
        </p>
      ) : null}
    </div>
  );
}
