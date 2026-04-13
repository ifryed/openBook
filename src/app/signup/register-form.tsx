"use client";

import { registerUser, type RegisterState } from "@/app/actions/register";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

const initial: RegisterState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-accent py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Sign up"}
    </button>
  );
}

export function RegisterForm({
  showGoogle,
  callbackUrl = "/",
}: {
  showGoogle?: boolean;
  callbackUrl?: string;
}) {
  const [state, formAction] = useActionState(registerUser, initial);

  return (
    <div className="space-y-6">
      {showGoogle ? (
        <div className="space-y-4">
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label="Sign up with Google"
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted">or</span>
            </div>
          </div>
        </div>
      ) : null}
      <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium">
        Display name (optional)
        <input
          name="name"
          type="text"
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium">
        Password (min 8 characters)
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
    </div>
  );
}
