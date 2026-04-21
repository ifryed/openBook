"use client";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function LoginForm({
  callbackUrl,
  showGoogle,
}: {
  callbackUrl: string;
  showGoogle?: boolean;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (res?.error) {
      setError(t("invalidCredentials"));
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {showGoogle ? (
        <div className="space-y-4">
          <GoogleSignInButton callbackUrl={callbackUrl} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted">{t("orDivider")}</span>
            </div>
          </div>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium">
          {t("email")}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? t("signingIn")
            : showGoogle
              ? t("signInWithEmail")
              : t("signInButton")}
        </button>
      </form>
      <p className="text-center text-xs leading-relaxed text-muted">
        {t.rich("signInLegalNote", {
          termsLink: (chunks) => (
            <Link href="/terms" className="text-accent no-underline hover:underline">
              {chunks}
            </Link>
          ),
          privacyLink: (chunks) => (
            <Link href="/privacy" className="text-accent no-underline hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
