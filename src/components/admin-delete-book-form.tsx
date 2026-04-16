"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  deleteBookAsAdmin,
  type DeleteBookAdminState,
} from "@/app/actions/books";

const initial: DeleteBookAdminState = {};

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete book permanently"}
    </button>
  );
}

export function AdminDeleteBookForm({
  bookSlug,
  bookTitle,
}: {
  bookSlug: string;
  bookTitle: string;
}) {
  const t = useTranslations("Drafts");
  const [state, formAction] = useActionState(deleteBookAsAdmin, initial);
  const [confirmTitle, setConfirmTitle] = useState("");
  const titleMatches = confirmTitle.trim() === bookTitle.trim();

  return (
    <section className="rounded-lg border-2 border-red-600 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-950">Admin</h2>
      <p className="mt-1 text-sm leading-snug text-red-900">
        Remove this book, all chapters, and revision history from the site. This
        cannot be undone.
      </p>
      <form
        action={formAction}
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          if (
            !confirm(
              t("confirmDeleteAdminBook", { title: bookTitle }),
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="bookSlug" value={bookSlug} />
        <label className="block text-sm font-medium text-red-950">
          Type the book title to confirm
          <input
            name="confirmTitle"
            type="text"
            value={confirmTitle}
            onChange={(e) => setConfirmTitle(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={bookTitle}
            className="mt-1 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted"
            aria-invalid={confirmTitle.length > 0 && !titleMatches}
          />
        </label>
        {confirmTitle.length > 0 && !titleMatches ? (
          <p className="text-xs text-red-800">
            Must match exactly:{" "}
            <span className="font-medium">{bookTitle}</span>
          </p>
        ) : null}
        {state.error ? (
          <p className="text-sm font-medium text-red-800" role="alert">
            {state.error}
          </p>
        ) : null}
        <DeleteButton disabled={!titleMatches} />
      </form>
    </section>
  );
}
