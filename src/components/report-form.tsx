"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitReport, type ReportState } from "@/app/actions/report";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-background disabled:opacity-50"
    >
      {pending ? "Sending…" : "Submit report"}
    </button>
  );
}

const initial: ReportState = {};

export function ReportForm({
  bookSlug,
  sectionSlug,
}: {
  bookSlug: string;
  sectionSlug?: string;
}) {
  const [state, formAction] = useActionState(submitReport, initial);

  if (state.ok) {
    return (
      <p className="text-sm text-muted" role="status">
        Thanks — moderators will review your report.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="bookSlug" value={bookSlug} />
      {sectionSlug ? (
        <input type="hidden" name="sectionSlug" value={sectionSlug} />
      ) : null}
      <label className="block text-sm font-medium text-foreground">
        Report this content
        <textarea
          name="reason"
          required
          minLength={10}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Describe what is wrong (spam, harassment, inaccurate claims, …)"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
