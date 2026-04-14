"use client";

import { fetchDraftReferenceContext } from "@/app/actions/references";
import {
  bookContextPromptInstruction,
  intendedAudiencePromptSnippet,
} from "@/lib/book-context";
import { WEBLLM_CHAT_OPTIONS, WEBLLM_MODEL } from "@/lib/webllm-model";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  bookTitle: string;
  figureName: string;
  intendedAges: string;
  bookContextMarkdown: string;
  sectionTitle: string;
  sectionSlug: string;
  currentBody: string;
  onApplyDraft: (markdown: string) => void;
};

export function ChapterAiDraftPanel({
  bookTitle,
  figureName,
  intendedAges,
  bookContextMarkdown,
  sectionTitle,
  sectionSlug,
  currentBody,
  onApplyDraft,
}: Props) {
  const engineRef = useRef<MLCEngine | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [guides, setGuides] = useState("");
  const [useReferenceLookup, setUseReferenceLookup] = useState(true);
  const [phase, setPhase] = useState<"idle" | "loading" | "generating">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      engineRef.current = null;
      void e?.unload();
    };
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator === "undefined" || !nav.gpu) {
      setError(
        "WebGPU is not available. Use a recent Chrome or Edge on desktop with a capable GPU.",
      );
      return;
    }

    if (
      currentBody.trim().length > 80 &&
      !confirm(
        "Replace the current editor content with the generated draft? (You can still cancel before publishing.)",
      )
    ) {
      return;
    }

    try {
      if (!engineRef.current) {
        setPhase("loading");
        setProgress(
          "Loading Llama 3.1 8B (first run may download several GB)…",
        );
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
        setModelReady(true);
      }

      let referenceBlock = "";
      if (useReferenceLookup) {
        setProgress(
          "Fetching snippets from Wikipedia, Wikidata, Open Library, Grokipedia…",
        );
        const refRes = await fetchDraftReferenceContext({
          guides,
          figureName,
          sectionTitle,
        });
        if (!refRes.ok) {
          setError(refRes.error);
          setPhase("idle");
          setProgress("");
          return;
        }
        referenceBlock = refRes.markdown.trim();
        if (!referenceBlock) {
          setProgress(
            "No encyclopedia/catalog snippets matched; drafting from book context only…",
          );
        }
      }

      setPhase("generating");
      setProgress("Writing chapter…");

      const engine = engineRef.current!;
      const guideBlock = guides.trim()
        ? guides.trim()
        : "Write a thorough, neutral biographical section suitable for a wiki-style book. Use Markdown (headings, lists where helpful).";

      const audienceLine = intendedAudiencePromptSnippet(intendedAges);

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
            ? "\n(No matching Wikipedia/Wikidata/Open Library/Grokipedia snippets were returned for the search phrases derived from your guides and the subject name. Rely on book context and guides; avoid fabricating specifics.)\n"
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
Chapter you are writing: "${sectionTitle}" (URL slug: ${sectionSlug})

Editor guidance — follow closely:
${guideBlock}

Produce the full Markdown body for this chapter only.`,
          },
        ],
        temperature: 0.35,
        max_tokens: 10000,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) {
        setError("The model returned empty text. Try again or shorten book context.");
        setPhase("idle");
        setProgress("");
        return;
      }

      let out = text;
      if (out.startsWith("```")) {
        out = out.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
      }

      onApplyDraft(out.trim());
      setPhase("idle");
      setProgress("");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Generation failed. Check the console.",
      );
      setPhase("idle");
      setProgress("");
    }
  }, [
    bookTitle,
    figureName,
    intendedAges,
    bookContextMarkdown,
    sectionTitle,
    sectionSlug,
    guides,
    useReferenceLookup,
    currentBody,
    onApplyDraft,
  ]);

  return (
    <section className="rounded-lg border border-dashed border-border bg-card/80 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
      >
        <span>
          Draft with local AI (WebLLM; full book or TOC + last chapter if long)
        </span>
        <span className="text-muted">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs text-muted leading-relaxed">
            The language model runs in your browser. Optional reference lookup
            asks OpenBook’s server to pull short snippets from{" "}
            <span className="text-foreground">Wikipedia</span>,{" "}
            <span className="text-foreground">Wikidata</span>,{" "}
            <span className="text-foreground">Open Library</span>, and{" "}
            <a
              href="https://grokipedia.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-border hover:decoration-foreground"
            >
              Grokipedia
            </a>{" "}
            (search phrases come from your guides and the subject name). Those snippets
            are merged into the prompt so the draft can align with common
            reference material—always verify anything important. Publishing a
            revision is still the only time your chapter is saved on the server.
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={useReferenceLookup}
              onChange={(e) => setUseReferenceLookup(e.target.checked)}
              disabled={phase !== "idle"}
              className="mt-0.5"
            />
            <span>
              Look up reference snippets online before generating (Wikipedia /
              Wikidata / Open Library / Grokipedia)
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">
              Guides for this chapter (tone, length, what to cover, sources to
              stress, etc.)
            </span>
            <textarea
              value={guides}
              onChange={(e) => setGuides(e.target.value)}
              rows={4}
              placeholder="e.g. Emphasize her 1920s experiments; one line per topic helps lookup (names, places, works) on Wikipedia, Open Library, or Grokipedia."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={phase !== "idle"}
            />
          </label>
          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {(phase === "loading" || phase === "generating") && (
            <p className="text-xs text-muted" aria-live="polite">
              {progress || "Working…"}
            </p>
          )}
          <button
            type="button"
            onClick={() => void generate()}
            disabled={phase !== "idle"}
            className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {modelReady ? "Regenerate draft" : "Load model & generate draft"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
