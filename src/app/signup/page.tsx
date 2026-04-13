import Link from "next/link";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { RegisterForm } from "./register-form";

export default function SignupPage() {
  const google = isGoogleAuthEnabled();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-muted">
          {google
            ? "Sign up with Google or email and password. You can create books and edit with full revision history."
            : "Anyone can sign up with email and password to create books and edit with full revision history."}
        </p>
      </div>
      <RegisterForm showGoogle={google} callbackUrl="/" />
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
