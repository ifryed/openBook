"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBook, type BookFormState } from "@/app/actions/books";
import { FigureNameField } from "@/components/figure-name-field";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";

const initial: BookFormState = {};

function SubmitButton({ blockSubmit }: { blockSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blockSubmit}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create book"}
    </button>
  );
}

export function CreateBookForm() {
  const [state, formAction] = useActionState(createBook, initial);
  const [figureOk, setFigureOk] = useState(false);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <label className="block text-sm font-medium">
        Book title
        <input
          name="title"
          required
          placeholder="e.g. The Life of Hypatia"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label htmlFor="create-figureName" className="block text-sm font-medium">
        Historical figure (canonical name)
      </label>
      <FigureNameField
        id="create-figureName"
        name="figureName"
        required
        placeholder="e.g. Hypatia of Alexandria"
        onValidityChange={setFigureOk}
      />
      <label htmlFor="create-intendedAges" className="block text-sm font-medium">
        Intended ages / audience
      </label>
      <IntendedAudienceSelect
        id="create-intendedAges"
        required
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      <span className="mt-1 block text-xs text-muted">
        Used for browsing filters and for local AI (reading level and tone).
      </span>
      <label className="block text-sm font-medium">
        Country / region (optional)
        <input
          name="country"
          maxLength={255}
          placeholder="e.g. India, France, United States"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          Used for browsing filters on the home page.
        </span>
      </label>
      <label className="block text-sm font-medium">
        URL slug (optional — short figure name + title if empty)
        <input
          name="slug"
          placeholder="hypatia"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <label className="block text-sm font-medium">
        Short summary (optional)
        <textarea
          name="summary"
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Tags (optional, comma-separated)
        <input
          name="tags"
          placeholder="philosophy, ancient-greece, mathematics"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {!figureOk ? (
        <p className="text-xs text-muted">
          Create is disabled until you see ✓ next to the figure name (after Check
          name → pick a person → Use selected person).
        </p>
      ) : null}
      <SubmitButton blockSubmit={!figureOk} />
    </form>
  );
}
