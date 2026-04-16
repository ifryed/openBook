"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  publishChapterDraftFromEditForm,
  type ContentDraftFormState,
  type PublishDraftFormState,
  updateChapterDraftAction,
} from "@/app/actions/content-drafts";
import type { ChapterDraftPayloadV1 } from "@/lib/content-draft-payload";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTranslations } from "next-intl";

const initialSave: ContentDraftFormState = {};
const initialPublish: PublishDraftFormState = {};

function CreateSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function EditChapterDraftActions({
  onPublish,
  publishPending,
}: {
  onPublish: () => void;
  publishPending: boolean;
}) {
  const { pending: savePending } = useFormStatus();
  const t = useTranslations("Drafts");
  const pending = savePending || publishPending;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
      >
        {savePending ? t("working") : t("saveAsDraft")}
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        onClick={onPublish}
      >
        {publishPending ? t("working") : t("publish")}
      </button>
    </div>
  );
}

export type ChapterDraftFormProps =
  | {
      mode: "create";
      formAction: (
        prev: ContentDraftFormState,
        formData: FormData,
      ) => Promise<ContentDraftFormState>;
      initial?: ChapterDraftPayloadV1 | null;
      submitLabel: string;
      submitPendingLabel: string;
    }
  | {
      mode: "edit";
      draftId: string;
      initial?: ChapterDraftPayloadV1 | null;
    };

export function ChapterDraftForm(props: ChapterDraftFormProps) {
  const p = props.initial;
  const formRef = useRef<HTMLFormElement>(null);

  const [saveState, saveAction] = useActionState(
    props.mode === "edit"
      ? updateChapterDraftAction.bind(null, props.draftId)
      : props.formAction,
    initialSave,
  );

  const [publishClientError, setPublishClientError] = useState<string | null>(
    null,
  );
  const [publishPending, startPublish] = useTransition();

  const formAction = props.mode === "edit" ? saveAction : props.formAction;
  const combinedError =
    saveState.error ||
    (props.mode === "edit" ? publishClientError ?? undefined : undefined);

  const runPublish = () => {
    if (props.mode !== "edit") return;
    const form = formRef.current;
    if (!form) return;
    setPublishClientError(null);
    startPublish(async () => {
      const fd = new FormData(form);
      try {
        const res = await publishChapterDraftFromEditForm(
          props.draftId,
          initialPublish,
          fd,
        );
        if (res?.error) {
          setPublishClientError(res.error);
        }
      } catch (e) {
        if (isRedirectError(e)) throw e;
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={formAction as unknown as (formData: FormData) => void}
      className="max-w-xl space-y-4"
    >
      <label className="block text-sm font-medium">
        Book URL slug
        <input
          name="targetBookSlug"
          required
          defaultValue={p?.targetBookSlug ?? ""}
          placeholder="existing-book-slug"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <p className="text-xs text-muted">
        The book must already exist on the site. Publishing adds a new section to that book.
      </p>
      <label className="block text-sm font-medium">
        Section title
        <input
          name="sectionTitle"
          defaultValue={p?.sectionTitle ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Section URL slug (optional)
        <input
          name="sectionSlug"
          defaultValue={p?.sectionSlug ?? ""}
          placeholder="Derived from title if empty"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <label className="block text-sm font-medium">
        Locale (BCP-47, e.g. en)
        <input
          name="locale"
          defaultValue={p?.locale ?? "en"}
          className="mt-1 w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <label className="block text-sm font-medium">
        Body (Markdown)
        <textarea
          name="body"
          rows={16}
          defaultValue={p?.body ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      {combinedError ? (
        <p className="text-sm text-red-700" role="alert">
          {combinedError}
        </p>
      ) : null}
      {props.mode === "edit" ? (
        <EditChapterDraftActions
          onPublish={runPublish}
          publishPending={publishPending}
        />
      ) : (
        <CreateSubmitButton
          label={props.submitLabel}
          pendingLabel={props.submitPendingLabel}
        />
      )}
    </form>
  );
}
