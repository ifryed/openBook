import Link from "next/link";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";
  const google = isGoogleAuthEnabled();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          {google
            ? "Sign in with Google or the email and password you registered with."
            : "Use the email and password you registered with."}
        </p>
      </div>
      <LoginForm callbackUrl={safeCallback} showGoogle={google} />
      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent">
          Sign up
        </Link>
      </p>
    </div>
  );
}
