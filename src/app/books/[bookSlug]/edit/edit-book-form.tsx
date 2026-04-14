"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { updateBook, type BookFormState } from "@/app/actions/books";
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
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditBookForm({
  bookSlug,
  title: initialTitle,
  figureName: initialFigureName,
  intendedAges: initialIntendedAges,
  country: initialCountry,
  summary: initialSummary,
  slug: initialSlug,
  tagsDisplay,
}: {
  bookSlug: string;
  title: string;
  figureName: string;
  intendedAges: string;
  country: string;
  summary: string | null;
  slug: string;
  tagsDisplay: string;
}) {
  const [state, formAction] = useActionState(
    updateBook.bind(null, bookSlug),
    initial,
  );
  const [figureOk, setFigureOk] = useState(
    () => initialFigureName.trim().length > 0,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <label className="block text-sm font-medium">
        Book title
        <input
          name="title"
          required
          defaultValue={initialTitle}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label htmlFor="edit-figureName" className="block text-sm font-medium">
        Historical figure (canonical name)
      </label>
      <FigureNameField
        id="edit-figureName"
        name="figureName"
        required
        defaultValue={initialFigureName}
        exemptMatch={initialFigureName}
        onValidityChange={setFigureOk}
      />
      <label htmlFor="edit-intendedAges" className="block text-sm font-medium">
        Intended ages / audience
      </label>
      <IntendedAudienceSelect
        id="edit-intendedAges"
        required
        defaultValue={initialIntendedAges}
        legacyValue={initialIntendedAges}
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
          defaultValue={initialCountry}
          placeholder="e.g. India, France, United States"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          Shown on the book page and used for filters on the home screen.
        </span>
      </label>
      <label className="block text-sm font-medium">
        URL slug
        <input
          name="slug"
          required
          defaultValue={initialSlug}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          Changing this moves the book to a new URL; links using the old address
          will stop working.
        </span>
      </label>
      <label className="block text-sm font-medium">
        Short summary (optional)
        <textarea
          name="summary"
          rows={3}
          defaultValue={initialSummary ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Tags (optional, comma-separated)
        <input
          name="tags"
          defaultValue={tagsDisplay}
          placeholder="philosophy, ancient-greece"
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
          Save is disabled until ✓ appears next to the figure name, or you leave the
          name unchanged from when you opened this page.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton blockSubmit={!figureOk} />
        <Link
          href={`/books/${bookSlug}`}
          className="text-sm text-muted no-underline hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
