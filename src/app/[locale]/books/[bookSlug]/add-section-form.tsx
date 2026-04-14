"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addSectionToBook,
  type AddSectionState,
} from "@/app/actions/books";

const initial: AddSectionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-background disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add section"}
    </button>
  );
}

export function AddSectionForm({ bookSlug }: { bookSlug: string }) {
  const [state, formAction] = useActionState(
    addSectionToBook.bind(null, bookSlug),
    initial,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block text-sm font-medium">
        New section title
        <input
          name="title"
          required
          placeholder="e.g. Early life"
          className="mt-1 w-56 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Slug (optional)
        <input
          name="slug"
          placeholder="early-life"
          className="mt-1 w-40 rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <SubmitButton />
      {state.error ? (
        <p className="w-full text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
