import { Link } from "@/i18n/navigation";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { localizedCallbackUrl } from "@/lib/localized-callback-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "./register-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("signUpTitle"),
    description: t("signUpBlurbEmail"),
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `/${locale}/signup`,
    },
  };
}

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
          {google ? t("signUpBlurbGoogle") : t("signUpBlurbEmail")}
        </p>
        {google ? (
          <p className="text-xs leading-relaxed text-muted">{t("signupGoogleTermsReminder")}</p>
        ) : null}
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
