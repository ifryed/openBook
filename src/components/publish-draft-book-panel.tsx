"use client";

import { publishDraftBook, type BookFormState } from "@/app/actions/books";
import { FigureNameField } from "@/components/figure-name-field";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

const initial: BookFormState = {};

function PublishButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("publishing") : t("publish")}
    </button>
  );
}

export function PublishDraftBookPanel({
  bookSlug,
  figureName,
}: {
  bookSlug: string;
  figureName: string;
}) {
  const t = useTranslations("Drafts");
  const [state, formAction] = useActionState(publishDraftBook, initial);
  const [figureOk, setFigureOk] = useState(false);

  return (
    <section className="rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-semibold text-foreground">{t("draftBookBannerTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("draftBookBannerIntro")}</p>
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="bookSlug" value={bookSlug} />
        <FigureNameField
          id="publish-draft-figure"
          name="figureName"
          required
          readOnly
          defaultValue={figureName}
          onValidityChange={setFigureOk}
        />
        {state.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <PublishButton disabled={!figureOk} />
      </form>
    </section>
  );
}
