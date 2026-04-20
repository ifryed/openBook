"use client";

import {
  importBookDraftJsonAction,
  type ContentDraftFormState,
} from "@/app/actions/content-drafts";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

const initial: ContentDraftFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("Drafts");
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("importBookJsonWorking") : t("importBookJsonSubmit")}
    </button>
  );
}

export function ImportBookDraftForm() {
  const t = useTranslations("Drafts");
  const [state, formAction] = useActionState(
    importBookDraftJsonAction,
    initial,
  );
  const [jsonText, setJsonText] = useState("");

  return (
    <form
      action={formAction as unknown as (formData: FormData) => void}
      className="max-w-xl space-y-4"
    >
      <input type="hidden" name="json" value={jsonText} />
      <label className="block text-sm font-medium">
        {t("importBookJsonFile")}
        <input
          type="file"
          accept=".json,application/json"
          className="mt-1 block w-full text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void f.text().then(setJsonText);
          }}
        />
      </label>
      <label className="block text-sm font-medium">
        {t("importBookJsonPaste")}
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={16}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
          placeholder='{"v":1,"title":"…","figureName":"…",…}'
        />
      </label>
      <p className="text-xs text-muted">{t("importBookJsonHint")}</p>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
