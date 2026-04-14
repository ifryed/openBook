"use client";

import { updateSectionTitle } from "@/app/actions/books";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function SectionTitleEditor({
  bookSlug,
  sectionSlug,
  initialTitle,
}: {
  bookSlug: string;
  sectionSlug: string;
  initialTitle: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const save = () => {
    const t = draft.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateSectionTitle(bookSlug, sectionSlug, t);
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
    </div>
  );
}
