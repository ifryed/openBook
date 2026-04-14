import { Link } from "@/i18n/navigation";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { localizedCallbackUrl } from "@/lib/localized-callback-url";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "./register-form";

type Props = { params: Promise<{ locale: string }> };

export default async function SignupPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const google = isGoogleAuthEnabled();
  const callbackUrl = localizedCallbackUrl("/", locale);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("signUpTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {google
            ? "Sign up with Google or email and password. You can create books and edit with full revision history."
            : "Anyone can sign up with email and password to create books and edit with full revision history."}
        </p>
      </div>
      <RegisterForm showGoogle={google} callbackUrl={callbackUrl} />
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-accent">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
