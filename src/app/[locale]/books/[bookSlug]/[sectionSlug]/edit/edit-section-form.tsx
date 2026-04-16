"use client";

import { saveSectionEditorAsChapterDraft } from "@/app/actions/content-drafts";
import { ChapterAiDraftPanel } from "@/components/chapter-ai-draft-panel";
import { ChapterTranslateBodyPanel } from "@/components/chapter-translate-body-panel";
import type { TranslateFromPrimaryContext } from "@/lib/translate-from-primary";
import { MarkdownBody } from "@/components/markdown-body";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteSectionFromBook,
  saveSectionRevision,
  type DeleteSectionState,
  type SaveRevisionState,
} from "@/app/actions/books";
import { useTranslations } from "next-intl";

const initial: SaveRevisionState = {};

function PublishRevisionButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("SectionEdit");
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("publishingRevision") : t("publishRevision")}
    </button>
  );
}

/** Draft books: one save path (revision on the draft book), labeled as draft — no “publish”. */
function SaveDraftBookChapterButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("SectionEdit");
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("savingDraft") : t("saveAsDraft")}
    </button>
  );
}

function SaveSectionDraftButton({
  draftPending,
  onSaveAsDraft,
}: {
  draftPending: boolean;
  onSaveAsDraft: () => void;
}) {
  const { pending: publishPending } = useFormStatus();
  const t = useTranslations("SectionEdit");
  return (
    <button
      type="button"
      disabled={publishPending || draftPending}
      onClick={onSaveAsDraft}
      className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
    >
      {draftPending ? t("savingDraft") : t("saveAsDraft")}
    </button>
  );
}

const deleteInitial: DeleteSectionState = {};

export function EditSectionForm({
  bookSlug,
  sectionSlug,
  locale,
  sectionTitle,
  initialBody,
  canDeleteChapter,
  bookTitle,
  figureName,
  intendedAges,
  bookContextMarkdown,
  translateFromPrimary,
  bookIsDraft,
}: {
  bookSlug: string;
  sectionSlug: string;
  locale: string;
  sectionTitle: string;
  initialBody: string;
  canDeleteChapter: boolean;
  bookTitle: string;
  figureName: string;
  intendedAges: string;
  bookContextMarkdown: string;
  translateFromPrimary: TranslateFromPrimaryContext | null;
  /** When true, only saving to the draft book is offered (no publish / no separate chapter JSON draft). */
  bookIsDraft: boolean;
}) {
  const t = useTranslations("SectionEdit");
  const [body, setBody] = useState(initialBody);
  const [bodyTab, setBodyTab] = useState<"edit" | "preview">("edit");
  const formRef = useRef<HTMLFormElement>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftPending, startDraftSave] = useTransition();

  useEffect(() => {
    setBody(initialBody);
  }, [initialBody]);

  useEffect(() => {
    setDraftSaved(false);
  }, [body]);

  const [state, formAction] = useActionState(
    saveSectionRevision.bind(null, bookSlug, sectionSlug),
    initial,
  );

  const [deleteState, deleteFormAction] = useActionState(
    deleteSectionFromBook.bind(null, bookSlug, sectionSlug),
    deleteInitial,
  );

  function onSaveAsDraft() {
    if (bookIsDraft) return;
    const form = formRef.current;
    if (!form) return;
    setDraftSaveError(null);
    setDraftSaved(false);
    startDraftSave(async () => {
      const fd = new FormData(form);
      const res = await saveSectionEditorAsChapterDraft(
        bookSlug,
        sectionSlug,
        locale,
        sectionTitle,
        fd,
      );
      if (res.error) {
        setDraftSaveError(res.error);
        return;
      }
      if (res.saved) {
        setDraftSaved(true);
      }
    });
  }

  return (
    <>
    {translateFromPrimary ? (
      <ChapterTranslateBodyPanel
        context={translateFromPrimary}
        currentBody={body}
        initialBody={initialBody}
        onApplyTranslation={setBody}
      />
    ) : null}
    <ChapterAiDraftPanel
      bookTitle={bookTitle}
      figureName={figureName}
      intendedAges={intendedAges}
      bookContextMarkdown={bookContextMarkdown}
      sectionTitle={sectionTitle}
      sectionSlug={sectionSlug}
      currentBody={body}
      onApplyDraft={setBody}
    />

    <form
      ref={formRef}
      action={formAction as unknown as (formData: FormData) => void}
      className="mt-6 space-y-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <label className="block text-sm font-medium">
        Edit summary (optional)
        <input
          name="summaryComment"
          placeholder="e.g. Fixed dates, added sources"
          className="mt-1 w-full max-w-xl rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <div className="block">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="text-sm font-medium">Body (Markdown)</span>
          <div
            className="flex rounded-md border border-border bg-card p-0.5 text-sm shadow-sm"
            role="tablist"
            aria-label="Body editor mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={bodyTab === "edit"}
              id="body-tab-edit"
              aria-controls="body-panel"
              onClick={() => setBodyTab("edit")}
              className={`rounded px-3 py-1 ${
                bodyTab === "edit"
                  ? "bg-accent !text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={bodyTab === "preview"}
              id="body-tab-preview"
              aria-controls="body-panel"
              onClick={() => setBodyTab("preview")}
              className={`rounded px-3 py-1 ${
                bodyTab === "preview"
                  ? "bg-accent !text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Preview
            </button>
          </div>
        </div>
        <div
          id="body-panel"
          role="tabpanel"
          aria-labelledby={
            bodyTab === "edit" ? "body-tab-edit" : "body-tab-preview"
          }
          className="mt-2"
        >
          <textarea
            name="body"
            required
            rows={20}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm ${
              bodyTab === "preview" ? "hidden" : ""
            }`}
          />
          {bodyTab === "preview" ? (
            <div className="min-h-[min(24rem,60vh)] w-full rounded-md border border-border bg-card px-3 py-3">
              {body.trim() ? (
                <MarkdownBody content={body} />
              ) : (
                <p className="text-sm text-muted">Nothing to preview yet.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {draftSaveError ? (
        <p className="text-sm text-red-700" role="alert">
          {draftSaveError}
        </p>
      ) : null}
      {!bookIsDraft && draftSaved ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status">
          {t("draftSavedHint")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {bookIsDraft ? (
          <SaveDraftBookChapterButton />
        ) : (
          <>
            <PublishRevisionButton />
            <SaveSectionDraftButton
              draftPending={draftPending}
              onSaveAsDraft={onSaveAsDraft}
            />
          </>
        )}
      </div>
    </form>

    <div className="mt-10 border-t border-border pt-6">
      <h2 className="text-sm font-medium text-foreground">Chapter</h2>
      {canDeleteChapter ? (
        <>
          <p className="mt-1 text-xs text-muted">
            Permanently remove this chapter and all of its revision history.
          </p>
          <form
            action={deleteFormAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  t("deleteChapterConfirm", { title: sectionTitle }),
                )
              ) {
                e.preventDefault();
              }
            }}
            className="mt-3"
          >
            {deleteState.error ? (
              <p className="mb-2 text-sm text-red-700" role="alert">
                {deleteState.error}
              </p>
            ) : null}
            <button
              type="submit"
              className="rounded-md border border-red-300 bg-card px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
            >
              Delete chapter
            </button>
          </form>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted">
          This is the only section in the book. Add another section from the
          book page before you can delete this chapter.
        </p>
      )}
    </div>
    </>
  );
}
