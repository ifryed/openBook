"use client";

import {
  deleteDraftBookAsOwner,
  type DeleteDraftBookState,
} from "@/app/actions/books";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

const initial: DeleteDraftBookState = {};

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? t("deleting") : t("delete")}
    </button>
  );
}

export function DeleteDraftBookForm({
  bookSlug,
  bookTitle,
}: {
  bookSlug: string;
  bookTitle: string;
}) {
  const t = useTranslations("Drafts");
  const [state, formAction] = useActionState(deleteDraftBookAsOwner, initial);
  const [confirmTitle, setConfirmTitle] = useState("");
  const titleMatches = confirmTitle.trim() === bookTitle.trim();

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        if (
          !confirm(
            t("confirmDeleteDraftBook", { title: bookTitle }),
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="bookSlug" value={bookSlug} />
      <label className="block text-sm font-medium">
        {t("deleteDraftBookConfirmLabel")}
        <input
          name="confirmTitle"
          type="text"
          value={confirmTitle}
          onChange={(e) => setConfirmTitle(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={bookTitle}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          aria-invalid={confirmTitle.length > 0 && !titleMatches}
        />
      </label>
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
      <DeleteButton disabled={!titleMatches} />
      <p className="text-sm text-muted">{t("deleteDraftBookHint")}</p>
    </form>
  );
}
