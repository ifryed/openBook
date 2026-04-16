"use client";

import {
  deleteDraftBookAsOwner,
  type DeleteDraftBookState,
} from "@/app/actions/books";
import { Link } from "@/i18n/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

const initial: DeleteDraftBookState = {};

const deleteTriggerClass =
  "shrink-0 rounded-md border border-red-700/40 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40";

function DeleteSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={deleteTriggerClass}
    >
      {pending ? t("deleting") : t("delete")}
    </button>
  );
}

/** Edit, Preview, Delete + title field on one line; hint and errors below. */
export function DraftBookActionsCell({
  bookSlug,
  bookTitle,
}: {
  bookSlug: string;
  bookTitle: string;
}) {
  const t = useTranslations("Drafts");
  const [state, formAction] = useActionState(deleteDraftBookAsOwner, initial);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const titleMatches = confirmTitle.trim() === bookTitle.trim();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (deleteArmed) {
      inputRef.current?.focus();
    }
  }, [deleteArmed]);

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-1.5">
      <div className="flex flex-wrap items-start gap-2">
        <Link
          href={`/books/${bookSlug}/edit`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground no-underline hover:bg-muted/40"
        >
          {t("edit")}
        </Link>
        <Link
          href={`/books/${bookSlug}`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground no-underline hover:bg-muted/40"
        >
          {t("previewDraftBook")}
        </Link>
        {!deleteArmed ? (
          <button
            type="button"
            onClick={() => setDeleteArmed(true)}
            className={deleteTriggerClass}
          >
            {t("delete")}
          </button>
        ) : (
          <form
            action={formAction}
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
            <input type="hidden" name="bookSlug" value={bookSlug} />
            <DeleteSubmitButton disabled={!titleMatches} />
            <label htmlFor={fieldId} className="sr-only">
              {t("deleteDraftBookConfirmLabel")}
            </label>
            <input
              ref={inputRef}
              id={fieldId}
              name="confirmTitle"
              type="text"
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={bookTitle}
              aria-invalid={confirmTitle.length > 0 && !titleMatches}
              className="min-w-[10rem] max-w-[16rem] flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm sm:max-w-xs"
            />
          </form>
        )}
      </div>
      {deleteArmed ? (
        <>
          <p className="text-xs text-muted">
            {t("deleteDraftBookUnderRowIntro")}
          </p>
          {confirmTitle.length > 0 && !titleMatches ? (
            <p className="text-xs text-muted">
              {t("deleteDraftBookMustMatch")}{" "}
              <span className="font-medium text-foreground">{bookTitle}</span>
            </p>
          ) : null}
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
