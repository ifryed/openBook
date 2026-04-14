"use client";

import { ensureWebLlmEngine } from "@/lib/webllm-engine-loader";
import { bookLocaleLabel } from "@/lib/book-locales";
import type { TranslateFromPrimaryContext } from "@/lib/translate-from-primary";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { useCallback, useEffect, useRef, useState } from "react";

const TRANSLATE_BODY_SYSTEM =
  "You are a professional translator. Preserve Markdown structure: headings, lists, links, emphasis, inline code, and fenced code blocks. Translate only the meaning; keep formatting parallel to the source. Output only the translated Markdown body with no preamble, no explanation, and no markdown code fence wrapping the entire output.";

type Props = {
  context: TranslateFromPrimaryContext;
  currentBody: string;
  initialBody: string;
  onApplyTranslation: (markdown: string) => void;
};

export function ChapterTranslateBodyPanel({
  context,
  currentBody,
  initialBody,
  onApplyTranslation,
}: Props) {
  const engineRef = useRef<MLCEngine | null>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "generating">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [consumedOnce, setConsumedOnce] = useState(false);

  useEffect(() => {
    setConsumedOnce(false);
  }, [initialBody]);

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      engineRef.current = null;
      void e?.unload();
    };
  }, []);

  const runTranslate = useCallback(async () => {
    setError(null);
    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator === "undefined" || !nav.gpu) {
      setError(
        "WebGPU is not available. Use a recent Chrome or Edge on desktop with a capable GPU.",
      );
      return;
    }

    if (!context.bodyReady) {
      return;
    }

    if (
      currentBody.trim().length > 80 &&
      !confirm(
        "Replace the current editor content with the translation? (You can still cancel before publishing.)",
      )
    ) {
      return;
    }

    try {
      if (!engineRef.current) {
        setPhase("loading");
        await ensureWebLlmEngine(engineRef, setProgress);
        setModelReady(true);
      }

      setPhase("generating");
      setProgress("Translating chapter body…");

      const fromLabel = bookLocaleLabel(context.primaryLocale);
      const toLabel = bookLocaleLabel(context.activeLocale);

      const engine = engineRef.current!;
      const completion = await engine.chat.completions.create({
        messages: [
          { role: "system", content: TRANSLATE_BODY_SYSTEM },
          {
            role: "user",
            content: `Translate the following text from ${fromLabel} (${context.primaryLocale}) to ${toLabel} (${context.activeLocale}).

---BEGIN SOURCE---
${context.sourceBody}
---END SOURCE---`,
          },
        ],
        temperature: 0.2,
        max_tokens: 10_000,
      });

      let text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) {
        setError("The model returned empty text. Try again or shorten the source chapter.");
        setPhase("idle");
        setProgress("");
        return;
      }
      if (text.startsWith("```")) {
        text = text
          .replace(/^```(?:markdown|md)?\s*/i, "")
          .replace(/\s*```$/i, "");
      }

      onApplyTranslation(text.trim());
      setConsumedOnce(true);
      setPhase("idle");
      setProgress("");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Translation failed. Check the console.",
      );
      setPhase("idle");
      setProgress("");
    }
  }, [context, currentBody, onApplyTranslation]);

  const primaryLabel = bookLocaleLabel(context.primaryLocale);
  const targetLabel = bookLocaleLabel(context.activeLocale);

  return (
    <section className="mb-4 rounded-lg border border-dashed border-border bg-card/80 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
      >
        <span>
          Translate body from primary language ({primaryLabel} → {targetLabel})
        </span>
        <span className="text-muted">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs text-muted leading-relaxed">
            Uses the same in-browser model as “Draft with local AI”. One
            automatic fill per edit session until you publish a revision (then
            you can translate again).
          </p>
          {!context.bodyReady ? (
            <p className="text-xs text-muted">
              Write this chapter in the primary language first, then open this
              editor in <strong>{targetLabel}</strong> to translate the body.
            </p>
          ) : null}
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
            onClick={() => void runTranslate()}
            disabled={
              phase !== "idle" || !context.bodyReady || consumedOnce
            }
            className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {consumedOnce
              ? "Translation applied (publish to translate again)"
              : modelReady
                ? "Translate body from primary"
                : "Load model & translate body"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
