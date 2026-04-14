"use client";

import { updateSectionTitle } from "@/app/actions/books";
import { ensureWebLlmEngine } from "@/lib/webllm-engine-loader";
import { bookLocaleLabel } from "@/lib/book-locales";
import type { TranslateFromPrimaryContext } from "@/lib/translate-from-primary";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const TRANSLATE_TITLE_SYSTEM =
  "You translate short chapter titles for biographical books. Preserve any light Markdown in the title (e.g. **bold**). Output only the translated title: one line, no quotes around it, no preamble or explanation.";

export function SectionTitleEditor({
  bookSlug,
  sectionSlug,
  locale,
  initialTitle,
  translateFromPrimary,
}: {
  bookSlug: string;
  sectionSlug: string;
  locale: string;
  initialTitle: string;
  translateFromPrimary?: TranslateFromPrimaryContext | null;
}) {
  const router = useRouter();
  const engineRef = useRef<MLCEngine | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translatePhase, setTranslatePhase] = useState<
    "idle" | "loading" | "generating"
  >("idle");
  const [translateProgress, setTranslateProgress] = useState("");
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [titleTranslateConsumed, setTitleTranslateConsumed] = useState(false);
  const [titleModelReady, setTitleModelReady] = useState(false);

  useEffect(() => {
    setTitleTranslateConsumed(false);
  }, [initialTitle]);

  useEffect(() => {
    return () => {
      const e = engineRef.current;
      engineRef.current = null;
      void e?.unload();
    };
  }, []);

  useEffect(() => {
    if (!editing) {
      setDraft(initialTitle);
    }
  }, [initialTitle, editing]);

  const openEdit = () => {
    setDraft(initialTitle);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(initialTitle);
    setError(null);
    setEditing(false);
  };

  const runTitleTranslate = useCallback(async () => {
    if (!translateFromPrimary?.titleReady) return;
    setTranslateError(null);
    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator === "undefined" || !nav.gpu) {
      setTranslateError(
        "WebGPU is not available. Use a recent Chrome or Edge on desktop with a capable GPU.",
      );
      return;
    }

    try {
      if (!engineRef.current) {
        setTranslatePhase("loading");
        await ensureWebLlmEngine(engineRef, setTranslateProgress);
        setTitleModelReady(true);
      }

      setTranslatePhase("generating");
      setTranslateProgress("Translating title…");

      const fromLabel = bookLocaleLabel(translateFromPrimary.primaryLocale);
      const toLabel = bookLocaleLabel(translateFromPrimary.activeLocale);
      const engine = engineRef.current!;

      const completion = await engine.chat.completions.create({
        messages: [
          { role: "system", content: TRANSLATE_TITLE_SYSTEM },
          {
            role: "user",
            content: `Translate this chapter title from ${fromLabel} (${translateFromPrimary.primaryLocale}) to ${toLabel} (${translateFromPrimary.activeLocale}):

${translateFromPrimary.sourceTitle}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      let text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) {
        setTranslateError("The model returned empty text. Try again.");
        setTranslatePhase("idle");
        setTranslateProgress("");
        return;
      }
      if (text.startsWith("```")) {
        text = text
          .replace(/^```[^\n]*\n?/i, "")
          .replace(/\s*```$/i, "");
      }
      text = text.trim();
      if (!text) {
        setTranslateError("The model returned empty text. Try again.");
        setTranslatePhase("idle");
        setTranslateProgress("");
        return;
      }

      setDraft(text);
      setEditing(true);
      setTitleTranslateConsumed(true);
      setTranslatePhase("idle");
      setTranslateProgress("");
    } catch (e) {
      console.error(e);
      setTranslateError(
        e instanceof Error ? e.message : "Translation failed. Check the console.",
      );
      setTranslatePhase("idle");
      setTranslateProgress("");
    }
  }, [translateFromPrimary]);

  const save = () => {
    const t = draft.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateSectionTitle(bookSlug, sectionSlug, locale, t);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-2 text-2xl font-semibold tracking-tight text-foreground"
        role="group"
        aria-label="Chapter title"
      >
        <span className="shrink-0">Edit:</span>
        {!editing ? (
          <>
            <span className="min-w-0">{initialTitle}</span>
            <button
              type="button"
              onClick={openEdit}
              aria-label="Edit chapter title"
              title="Edit chapter title"
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-1.5 text-muted hover:border-border hover:bg-muted/40 hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.419a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={pending}
              autoFocus
              className="min-w-[12rem] max-w-full flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-2xl font-semibold text-foreground"
            />
            <span className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="text-sm text-muted underline-offset-2 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="text-sm font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </span>
          </>
        )}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {translateFromPrimary ? (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-card/80 p-3">
          <button
            type="button"
            onClick={() => setTranslateOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground"
          >
            <span>
              Translate title from primary (
              {bookLocaleLabel(translateFromPrimary.primaryLocale)} →{" "}
              {bookLocaleLabel(translateFromPrimary.activeLocale)})
            </span>
            <span className="text-muted">{translateOpen ? "▼" : "▶"}</span>
          </button>
          {translateOpen ? (
            <div className="mt-2 space-y-2 text-xs">
              <p className="text-muted leading-relaxed">
                In-browser model (same as chapter draft). One automatic fill
                per edit session until you save the title.
              </p>
              {!translateFromPrimary.titleReady ? (
                <p className="text-muted">
                  Add a chapter title in the primary language first, then use
                  this here.
                </p>
              ) : null}
              {translateError ? (
                <p className="text-red-700" role="alert">
                  {translateError}
                </p>
              ) : null}
              {(translatePhase === "loading" ||
                translatePhase === "generating") && (
                <p className="text-muted" aria-live="polite">
                  {translateProgress || "Working…"}
                </p>
              )}
              <button
                type="button"
                onClick={() => void runTitleTranslate()}
                disabled={
                  translatePhase !== "idle" ||
                  !translateFromPrimary.titleReady ||
                  titleTranslateConsumed
                }
                className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {titleTranslateConsumed
                  ? "Translation applied (save title to translate again)"
                  : titleModelReady
                    ? "Translate title from primary"
                    : "Load model & translate title"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
