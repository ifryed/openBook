"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  publishBookDraftFromEditForm,
  type ContentDraftFormState,
  type PublishDraftFormState,
  updateBookDraftAction,
} from "@/app/actions/content-drafts";
import { BookPrimaryLanguageSelect } from "@/components/book-primary-language-select";
import { FigureNameField } from "@/components/figure-name-field";
import { IntendedAudienceSelect } from "@/components/intended-audience-select";
import type { BookDraftPayloadV1 } from "@/lib/content-draft-payload";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTranslations } from "next-intl";

const initialSave: ContentDraftFormState = {};
const initialPublish: PublishDraftFormState = {};

function DraftCreateActions({
  saveLabel,
  savePendingLabel,
  editContentLabel,
  editContentHint,
}: {
  saveLabel: string;
  savePendingLabel: string;
  editContentLabel: string;
  editContentHint: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        name="draftAfterSave"
        value="details"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? savePendingLabel : saveLabel}
      </button>
      <button
        type="submit"
        name="draftAfterSave"
        value="contents"
        disabled={pending}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
        title={editContentHint}
      >
        {pending ? savePendingLabel : editContentLabel}
      </button>
    </div>
  );
}

function EditBookDraftActions({
  blockPublish,
  onPublish,
  publishPending,
}: {
  blockPublish: boolean;
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
        disabled={pending || blockPublish}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
      >
        {savePending ? t("working") : t("saveAsDraft")}
      </button>
      <button
        type="button"
        disabled={pending || blockPublish}
        className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        onClick={onPublish}
      >
        {publishPending ? t("working") : t("publish")}
      </button>
    </div>
  );
}

export type BookDraftFormProps =
  | {
      mode: "create";
      formAction: (
        prev: ContentDraftFormState,
        formData: FormData,
      ) => Promise<ContentDraftFormState>;
      initial?: BookDraftPayloadV1 | null;
      submitLabel: string;
      submitPendingLabel: string;
    }
  | {
      mode: "edit";
      draftId: string;
      initial?: BookDraftPayloadV1 | null;
    };

function draftHasStoredFigureVerification(
  payload: BookDraftPayloadV1 | null | undefined,
): boolean {
  return Boolean(
    payload?.figureVerifiedKind?.trim() && payload?.figureVerifiedKey?.trim(),
  );
}

export function BookDraftForm(props: BookDraftFormProps) {
  const p = props.initial;
  const formRef = useRef<HTMLFormElement>(null);
  const tDrafts = useTranslations("Drafts");

  const figureExemptMatch =
    props.mode === "edit" && draftHasStoredFigureVerification(p)
      ? p?.figureName
      : undefined;

  const [saveState, saveAction] = useActionState(
    props.mode === "edit"
      ? updateBookDraftAction.bind(null, props.draftId)
      : props.formAction,
    initialSave,
  );

  const [publishClientError, setPublishClientError] = useState<string | null>(
    null,
  );
  const [publishPending, startPublish] = useTransition();

  const [figureOk, setFigureOk] = useState(
    () =>
      props.mode === "edit" &&
      Boolean(p?.figureName?.trim()) &&
      draftHasStoredFigureVerification(p),
  );

  const chaptersJsonDefault =
    p?.chapters && p.chapters.length > 0
      ? JSON.stringify(
          p.chapters.map((c) => ({
            slug: c.slug,
            title: c.title,
            body: c.body,
          })),
          null,
          2,
        )
      : "";

  /* `saveAction` must be the form `action` so the server action gets `(prevState, formData)` from useActionState. Passing `props.formAction` directly invokes it with only FormData → second arg undefined. */
  const combinedError =
    saveState.error ||
    (props.mode === "edit" ? publishClientError ?? undefined : undefined);

  const blockFigure = !figureOk;

  const runPublish = () => {
    if (props.mode !== "edit" || blockFigure) return;
    const form = formRef.current;
    if (!form) return;
    setPublishClientError(null);
    startPublish(async () => {
      const fd = new FormData(form);
      try {
        const res = await publishBookDraftFromEditForm(
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
      action={saveAction as unknown as (formData: FormData) => void}
      className="max-w-xl space-y-4"
    >
      <label className="block text-sm font-medium">
        Book title
        <input
          name="title"
          required
          defaultValue={p?.title ?? ""}
          placeholder="e.g. The Life of Hypatia"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label htmlFor="draft-figureName" className="block text-sm font-medium">
        Historical figure (canonical name)
      </label>
      <FigureNameField
        id="draft-figureName"
        name="figureName"
        required
        defaultValue={p?.figureName ?? ""}
        exemptMatch={figureExemptMatch}
        onValidityChange={setFigureOk}
      />
      <label htmlFor="draft-intendedAges" className="block text-sm font-medium">
        Intended ages / audience
      </label>
      <IntendedAudienceSelect
        id="draft-intendedAges"
        required
        defaultValue={p?.intendedAges ?? ""}
        legacyValue={p?.intendedAges}
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      <span className="mt-1 block text-xs text-muted">
        Used for browsing filters and for local AI (reading level and tone).
      </span>
      <label
        htmlFor="draft-defaultLocale-search"
        className="block text-sm font-medium"
      >
        Primary language
      </label>
      <BookPrimaryLanguageSelect
        id="draft-defaultLocale"
        defaultValue={p?.defaultLocale}
      />
      <label className="block text-sm font-medium">
        Country / region (optional)
        <input
          name="country"
          maxLength={255}
          defaultValue={p?.country ?? ""}
          placeholder="e.g. India, France, United States"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        URL slug (optional — short figure name + title if empty)
        <input
          name="slug"
          defaultValue={p?.slug ?? ""}
          placeholder="hypatia"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-xs"
        />
      </label>
      <label className="block text-sm font-medium">
        Short summary (optional)
        <textarea
          name="summary"
          rows={3}
          defaultValue={p?.summary ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Tags (optional, comma-separated)
        <input
          name="tags"
          defaultValue={p?.tags ?? ""}
          placeholder="philosophy, ancient-greece, mathematics"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="includeIntroduction"
          defaultChecked={p?.includeIntroduction ?? false}
          className="mt-1"
        />
        <span>
          Include Introduction section (empty starter unless you add chapters below)
        </span>
      </label>
      {props.mode === "edit" ? (
        <>
          <label className="block text-sm font-medium">
            Chapters JSON (optional)
            <textarea
              name="chaptersJson"
              rows={10}
              defaultValue={chaptersJsonDefault}
              placeholder={`[\n  { "slug": "early-life", "title": "Early life", "body": "# Early life\\n\\n…" }\n]`}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
            />
          </label>
          <p className="text-xs text-muted">
            If this array is non-empty, publishing creates the book and all sections in one step
            (same limits as the auto wizard). Leave empty to publish metadata only (plus optional
            Introduction).
          </p>
        </>
      ) : null}
      {combinedError ? (
        <p className="text-sm text-red-700" role="alert">
          {combinedError}
        </p>
      ) : null}
      {props.mode === "edit" ? (
        <EditBookDraftActions
          blockPublish={blockFigure}
          onPublish={runPublish}
          publishPending={publishPending}
        />
      ) : (
        <DraftCreateActions
          saveLabel={props.submitLabel}
          savePendingLabel={props.submitPendingLabel}
          editContentLabel={tDrafts("editContent")}
          editContentHint={tDrafts("editContentHint")}
        />
      )}
    </form>
  );
}
