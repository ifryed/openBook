"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  publishContentDraftForm,
  type PublishDraftFormState,
} from "@/app/actions/content-drafts";
import { useTranslations } from "next-intl";

const initial: PublishDraftFormState = {};

function PublishButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-50"
    >
      {pending ? t("publishing") : t("publish")}
    </button>
  );
}

export function DraftPublishForm({ draftId }: { draftId: string }) {
  const [state, action] = useActionState(publishContentDraftForm, initial);

  return (
    <div className="space-y-1">
      <form action={action} className="inline">
        <input type="hidden" name="draftId" value={draftId} />
        <PublishButton />
      </form>
      {state.error ? (
        <p className="max-w-xs text-xs text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
