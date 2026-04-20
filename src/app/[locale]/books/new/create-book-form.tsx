"use client";

import { createBookDraftAction } from "@/app/actions/content-drafts";
import { createBook, type BookFormState } from "@/app/actions/books";
import { BookPrimaryLanguageSelect } from "@/components/book-primary-language-select";
import { FigureNameField } from "@/components/figure-name-field";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

const initial: BookFormState = {};

function CreateBookSubmitButton({ blockSubmit }: { blockSubmit: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("NewBook");
  return (
    <button
      type="submit"
      disabled={pending || blockSubmit}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("creatingBook") : t("createBook")}
    </button>
  );
}

function NewBookDraftActions({
  draftPending,
  onSaveDraft,
}: {
  draftPending: boolean;
  onSaveDraft: (after: "details" | "contents") => void;
}) {
  const { pending: createPending } = useFormStatus();
  const t = useTranslations("Drafts");
  const pending = createPending || draftPending;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => onSaveDraft("details")}
        className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        {draftPending ? t("savingDraft") : t("saveAsDraft")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onSaveDraft("contents")}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
        title={t("editContentHint")}
      >
        {draftPending ? t("savingDraft") : t("editContent")}
      </button>
    </div>
  );
}

export function CreateBookForm() {
  const t = useTranslations("NewBook");
  const f = useTranslations("BookForm");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createBook, initial);
  const [figureOk, setFigureOk] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftPending, startDraftSave] = useTransition();

  function onSaveDraft(after: "details" | "contents") {
    const form = formRef.current;
    if (!form) return;
    setDraftError(null);
    startDraftSave(async () => {
      const fd = new FormData(form);
      fd.set("draftAfterSave", after);
      try {
        const res = await createBookDraftAction({}, fd);
        if (res?.error) {
          setDraftError(res.error);
        }
      } catch (e) {
        if (isRedirectError(e)) throw e;
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction as unknown as (formData: FormData) => void}
      className="max-w-xl space-y-4"
    >
      <label className="block text-sm font-medium">
        {f("bookTitle")}
        <input
          name="title"
          required
          placeholder={f("bookTitlePlaceholder")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label htmlFor="create-figureName" className="block text-sm font-medium">
        {f("figureLabel")}
      </label>
      <FigureNameField
        id="create-figureName"
        name="figureName"
        required
        placeholder={f("figurePlaceholder")}
        onValidityChange={setFigureOk}
      />
      <label htmlFor="create-intendedAges" className="block text-sm font-medium">
        {f("intendedAges")}
      </label>
      <IntendedAudienceSelect
        id="create-intendedAges"
        required
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      <span className="mt-1 block text-xs text-muted">
        {f("intendedAgesHint")}
      </span>
      <label
        htmlFor="create-defaultLocale-search"
        className="block text-sm font-medium"
      >
        {f("primaryLanguage")}
      </label>
      <BookPrimaryLanguageSelect id="create-defaultLocale" />
      <p className="mt-1 text-xs text-muted">
        {f("primaryLanguageHintCreate")}
      </p>
      <label className="block text-sm font-medium">
        {f("country")}
        <input
          name="country"
          maxLength={255}
          placeholder={f("countryPlaceholder")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          {f("countryHintCreate")}
        </span>
      </label>
      <label className="block text-sm font-medium">
        {f("slugCreate")}
        <input
          name="slug"
          placeholder={f("slugPlaceholder")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <label className="block text-sm font-medium">
        {f("summary")}
        <textarea
          name="summary"
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        {f("tags")}
        <input
          name="tags"
          placeholder={f("tagsPlaceholderCreate")}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {draftError ? (
        <p className="text-sm text-red-700" role="alert">
          {draftError}
        </p>
      ) : null}
      {!figureOk ? (
        <p className="text-xs text-muted">{t("figureCreateHint")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CreateBookSubmitButton blockSubmit={!figureOk} />
        <NewBookDraftActions
          draftPending={draftPending}
          onSaveDraft={onSaveDraft}
        />
      </div>
    </form>
  );
}
