"use client";

import { useActionState, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { updateBook, type BookFormState } from "@/app/actions/books";
import { FigureNameField } from "@/components/figure-name-field";
import { bookLocaleLabel } from "@/lib/book-locales";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";

const initial: BookFormState = {};

function SubmitButton({ blockSubmit }: { blockSubmit: boolean }) {
  const { pending } = useFormStatus();
  const c = useTranslations("Common");
  const d = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending || blockSubmit}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? c("saving") : d("saveChanges")}
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
  bookLanguages,
  bookDefaultLocale,
}: {
  bookSlug: string;
  title: string;
  figureName: string;
  intendedAges: string;
  country: string;
  summary: string | null;
  slug: string;
  tagsDisplay: string;
  bookLanguages: string[];
  bookDefaultLocale: string;
}) {
  const f = useTranslations("BookForm");
  const c = useTranslations("Common");
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
        {f("bookTitle")}
        <input
          name="title"
          required
          defaultValue={initialTitle}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label htmlFor="edit-figureName" className="block text-sm font-medium">
        {f("figureLabel")}
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
        {f("intendedAges")}
      </label>
      <IntendedAudienceSelect
        id="edit-intendedAges"
        required
        defaultValue={initialIntendedAges}
        legacyValue={initialIntendedAges}
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      <span className="mt-1 block text-xs text-muted">
        {f("intendedAgesHint")}
      </span>
      <label htmlFor="edit-defaultLocale" className="block text-sm font-medium">
        {f("primaryLanguage")}
      </label>
      <select
        id="edit-defaultLocale"
        name="defaultLocale"
        required
        defaultValue={bookDefaultLocale}
        className="mt-1 w-full max-w-md rounded-md border border-border bg-card px-3 py-2 text-sm"
      >
        {bookLanguages.map((loc) => (
          <option key={loc} value={loc}>
            {bookLocaleLabel(loc)} ({loc})
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">
        {f("primaryLanguageHintEdit")}
      </p>
      <label className="block text-sm font-medium">
        {f("country")}
        <input
          name="country"
          maxLength={255}
          defaultValue={initialCountry}
          placeholder={f("countryPlaceholder")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          {f("countryHintEdit")}
        </span>
      </label>
      <label className="block text-sm font-medium">
        {f("slugEdit")}
        <input
          name="slug"
          required
          defaultValue={initialSlug}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          {f("slugEditWarning")}
        </span>
      </label>
      <label className="block text-sm font-medium">
        {f("summary")}
        <textarea
          name="summary"
          rows={3}
          defaultValue={initialSummary ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        {f("tags")}
        <input
          name="tags"
          defaultValue={tagsDisplay}
          placeholder={f("tagsPlaceholderEdit")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {!figureOk ? (
        <p className="text-xs text-muted">{f("figureEditHint")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton blockSubmit={!figureOk} />
        <Link
          href={`/books/${bookSlug}`}
          className="text-sm text-muted no-underline hover:underline"
        >
          {c("cancel")}
        </Link>
      </div>
    </form>
  );
}
