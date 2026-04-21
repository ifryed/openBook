"use client";

import {
  acceptTermsAction,
  type AcceptTermsState,
} from "@/app/actions/accept-terms";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

const initial: AcceptTermsState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("AcceptTerms");
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-accent py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t("submitting") : t("submit")}
    </button>
  );
}

export function AcceptTermsForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("AcceptTerms");
  const router = useRouter();
  const { update } = useSession();
  const [state, formAction] = useActionState(acceptTermsAction, initial);
  const handledOk = useRef(false);

  useEffect(() => {
    if (!state.ok || handledOk.current) return;
    handledOk.current = true;
    void (async () => {
      await update();
      router.push(callbackUrl);
      router.refresh();
    })();
  }, [state.ok, update, router, callbackUrl]);

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">{t("intro")}</p>
      <ul className="list-inside list-disc space-y-2 text-sm text-muted">
        <li>{t("bulletTerms")}</li>
        <li>{t("bulletPrivacy")}</li>
        <li>{t("bulletLicense")}</li>
      </ul>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="acceptTerms"
          value="on"
          required
          className="mt-1"
        />
        <span>
          {t.rich("checkboxLabel", {
            termsLink: (chunks) => (
              <Link href="/terms" className="font-medium text-accent no-underline hover:underline">
                {chunks}
              </Link>
            ),
            privacyLink: (chunks) => (
              <Link href="/privacy" className="font-medium text-accent no-underline hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
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
