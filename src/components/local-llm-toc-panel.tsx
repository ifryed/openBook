"use client";

import { addTocSectionsFromLlm } from "@/app/actions/books";
import { intendedAudiencePromptSnippet } from "@/lib/book-context";
import {
  parseTocFromLlmText,
  type TocSuggestion,
} from "@/lib/llm-toc-parse";
import { WEBLLM_MODEL } from "@/lib/webllm-model";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type { TocSuggestion };

type PanelProps = {
  bookSlug: string;
  bookTitle: string;
  figureName: string;
  intendedAges: string;
  existingSlugs: string[];
};

export function LocalLlmTocPanel({
  bookSlug,
  bookTitle,
  figureName,
  intendedAges,
  existingSlugs,
}: PanelProps) {
  const router = useRouter();
  const engineRef = useRef<MLCEngine | null>(null);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "loading" | "generating" | "done" | "adding"
  >("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TocSuggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [modelReady, setModelReady] = useState(false);
  /** Last run: exact assistant text for debugging parse / model issues */
  const [rawResponses, setRawResponses] = useState<{
    step1: string | null;
    step2: string | null;
  }>({ step1: null, step2: null });

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      engineRef.current = null;
      void e?.unload();
    };
  }, []);

  const toggleSlug = useCallback((slug: string) => {
    setSelected((s) => ({ ...s, [slug]: !s[slug] }));
  }, []);

  const runGenerate = useCallback(async () => {
    setError(null);
    setSuggestions([]);
    setSelected({});
    setRawResponses({ step1: null, step2: null });

    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator === "undefined" || !nav.gpu) {
      setError(
        "WebGPU is not available. Use a recent Chrome or Edge on desktop, or enable WebGPU in your browser.",
      );
      return;
    }

    try {
      if (!engineRef.current) {
        setPhase("loading");
        setProgress(
          "Loading WebLLM — Llama 3.1 8B (first run may download several GB to browser cache)…",
        );
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        const engine = await CreateMLCEngine(WEBLLM_MODEL, {
          initProgressCallback: (report) => {
            setProgress(
              `${report.text} (${Math.round(report.progress * 100)}%)`,
            );
          },
        });
        engineRef.current = engine;
        setModelReady(true);
      }

      setPhase("generating");

      const engine = engineRef.current!;
      const userBlock = notes.trim()
        ? `Additional direction from the editor:\n${notes.trim()}`
        : "No extra notes.";
      const audienceLine = intendedAudiencePromptSnippet(intendedAges);

      // Step 1: “research” — consolidate major life events from model knowledge (no web access).
      setProgress("Step 1 of 2: outlining important life events…");
      const researchCompletion = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You help plan biographies using well-established historical and public knowledge. You cannot browse the web. Prefer facts widely attested in reference works; if you are unsure, omit rather than invent. The editor states an intended readership (ages/audience): weight which life themes matter for that audience (depth vs. skim, emphasis) without inventing facts. Reply in plain text only.",
          },
          {
            role: "user",
            content: `For a biographical book we are structuring in OpenBook.

Book title: ${bookTitle}
Historical figure: ${figureName}
${audienceLine}
${userBlock}

Task: list ONLY important events, periods, roles, and turning points in this person's life that deserve chapters or major sections. Use 10–20 short bullet lines (one event or theme per line), in rough chronological order. Focus on what historians and general encyclopedias typically emphasize. Do not include a table of contents yet — bullets only, no JSON.`,
          },
        ],
        temperature: 0.35,
        max_tokens: 1400,
      });

      const rawResearch =
        researchCompletion.choices[0]?.message?.content ?? "";
      setRawResponses((prev) => ({ ...prev, step1: rawResearch }));
      const lifeEventsText = rawResearch.trim();
      if (!lifeEventsText || lifeEventsText.length < 40) {
        setError(
          "The model did not produce enough life-event notes. Try different optional notes, or a better-known figure. Open “Raw model responses” below to see what the model returned.",
        );
        setPhase("idle");
        setProgress("");
        return;
      }

      const eventsForPrompt = lifeEventsText.slice(0, 6000);

      // Step 2: table of contents derived strictly from that research pass.
      setProgress("Step 2 of 2: turning events into a table of contents…");
      const completion = await engine.chat.completions.create({
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
${userBlock}

Below is a research pass listing important events and themes in this person's life. Your chapters must reflect these events (merge or split bullets into coherent sections; you do not need one chapter per bullet).

--- Life events and themes ---
${eventsForPrompt}
--- end ---

Output format — follow exactly:
- Write 6 to 12 lines. Each line is ONE compact JSON object and nothing else on that line.
- Each object MUST have exactly: "title" (string) and "slug" (string). No summary, no other fields.
- slug: lowercase, a-z 0-9 and hyphens only, no spaces, matches the chapter title (e.g. title "Early life" → slug "early-life"). Each slug must differ from the others.
- Do NOT wrap lines in [ ]. One object per line. No trailing commas.

Example:
{"title":"Early life and education","slug":"early-life-and-education"}
{"title":"Political rise","slug":"political-rise"}`,
          },
        ],
        temperature: 0.12,
        max_tokens: 2048,
      });

      const rawToc = completion.choices[0]?.message?.content ?? "";
      setRawResponses((prev) => ({ ...prev, step2: rawToc }));
      const text = rawToc;
      const parsed = parseTocFromLlmText(text);
      const existing = new Set(existingSlugs.map((s) => s.toLowerCase()));
      const filtered = parsed.filter(
        (p) => !existing.has(p.slug.toLowerCase()) && p.slug !== "introduction",
      );

      if (filtered.length === 0) {
        setError(
          "The model did not return usable JSON sections. Open “Raw model responses” below — step 2 shows the TOC reply; fix formatting or try again.",
        );
        setPhase("idle");
        setProgress("");
        return;
      }

      setSuggestions(filtered);
      const sel: Record<string, boolean> = {};
      for (const s of filtered) sel[s.slug] = true;
      setSelected(sel);
      setPhase("done");
      setProgress("");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Check the console and your WebGPU / memory limits.",
      );
      setPhase("idle");
      setProgress("");
    }
  }, [bookTitle, figureName, intendedAges, notes, existingSlugs]);

  const addSelected = useCallback(async () => {
    const rows = suggestions.filter((s) => selected[s.slug]);
    if (rows.length === 0) {
      setError("Select at least one section to add.");
      return;
    }
    setError(null);
    setPhase("adding");
    const res = await addTocSectionsFromLlm(bookSlug, JSON.stringify(rows));
    setPhase("done");
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuggestions([]);
    setSelected({});
    setPhase("idle");
    router.refresh();
  }, [bookSlug, suggestions, selected, router]);

  return (
    <section className="rounded-lg border border-dashed border-border bg-card/80 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
      >
        <span>Suggest contents with a local in-browser model (WebLLM)</span>
        <span className="text-muted">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-xs text-muted leading-relaxed">
            Runs entirely in your browser via WebGPU: the model and prompts do not
            go through OpenBook servers. Generation is two steps — first it drafts
            important life events from its training knowledge (not live web
            research), then it builds the table of contents from that list. The
            first run downloads the 8B model into your browser cache (often
            several&nbsp;GB). When you add sections, only the chosen titles/slugs are
            sent to the app like normal edits.
          </p>

          <label className="block">
            <span className="text-xs font-medium text-muted">
              Optional notes (applied to both the life-events pass and the TOC)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Focus on her scientific career and Nobel prizes; keep personal life brief."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={phase === "loading" || phase === "generating" || phase === "adding"}
            />
          </label>

          {(phase === "loading" || phase === "generating" || phase === "adding") && (
            <p className="text-xs text-muted" aria-live="polite">
              {phase === "adding" ? "Adding sections…" : progress || "Working…"}
            </p>
          )}

          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {(rawResponses.step1 !== null || rawResponses.step2 !== null) && (
            <details className="rounded-md border border-border bg-background p-2">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Raw model responses (debug)
              </summary>
              <p className="mt-2 text-xs text-muted">
                Step 1 = life-events pass. Step 2 = JSON Lines with title + slug
                per line; the app normalizes slugs and fixes collisions. A JSON
                array of the same objects still parses.
              </p>
              {rawResponses.step1 !== null ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-foreground">
                    Step 1 — life events
                  </p>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-card p-2 font-mono text-[11px] text-foreground">
                    {rawResponses.step1 || "(empty)"}
                  </pre>
                </div>
              ) : null}
              {rawResponses.step2 !== null ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-foreground">
                    Step 2 — NDJSON / chapter objects
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-card p-2 font-mono text-[11px] text-foreground">
                    {rawResponses.step2 || "(empty)"}
                  </pre>
                </div>
              ) : null}
            </details>
          )}

          <button
            type="button"
            onClick={() => void runGenerate()}
            disabled={
              phase === "loading" ||
              phase === "generating" ||
              phase === "adding"
            }
            className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {modelReady
              ? "Regenerate outline"
              : "Load model & generate outline"}
          </button>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">
                Suggested sections (skip ones you already have or don’t want)
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {suggestions.map((s) => (
                  <li key={s.slug} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      id={`toc-${s.slug}`}
                      checked={Boolean(selected[s.slug])}
                      onChange={() => toggleSlug(s.slug)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`toc-${s.slug}`} className="cursor-pointer">
                      <span className="font-medium">{s.title}</span>
                      <span className="ml-2 font-mono text-muted">/{s.slug}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void addSelected()}
                disabled={phase === "adding"}
                className="rounded-md bg-accent px-3 py-2 text-xs font-medium !text-white hover:opacity-90 disabled:opacity-50"
              >
                Add selected to book
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
