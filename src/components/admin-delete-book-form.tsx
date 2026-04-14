"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteBookAsAdmin,
  type DeleteBookAdminState,
} from "@/app/actions/books";

const initial: DeleteBookAdminState = {};

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
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
  const [state, formAction] = useActionState(deleteBookAsAdmin, initial);

  return (
    <section className="rounded-lg border-2 border-red-600 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-950">Admin</h2>
      <p className="mt-1 text-sm leading-snug text-red-900">
        Remove this book, all chapters, and revision history from the site. This
        cannot be undone.
      </p>
      <form
        action={formAction}
        className="mt-3"
        onSubmit={(e) => {
          if (
            !confirm(
              `Permanently delete “${bookTitle}” and all of its sections and history? This cannot be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="bookSlug" value={bookSlug} />
        {state.error ? (
          <p className="mb-2 text-sm font-medium text-red-800" role="alert">
            {state.error}
          </p>
        ) : null}
        <DeleteButton />
      </form>
    </section>
  );
}
