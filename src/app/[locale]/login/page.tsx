import { Link } from "@/i18n/navigation";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { localizedCallbackUrl } from "@/lib/localized-callback-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("signInTitle"),
    description: t("signInBlurbEmail"),
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `/${locale}/login`,
    },
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  const { callbackUrl } = await searchParams;
  const safeCallback = localizedCallbackUrl(callbackUrl, locale);
  const google = isGoogleAuthEnabled();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("signInTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {google ? t("signInBlurbGoogle") : t("signInBlurbEmail")}
        </p>
      </div>
      <LoginForm callbackUrl={safeCallback} showGoogle={google} />
      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-accent">
          {t("signUpLink")}
        </Link>
      </p>
    </div>
  );
}
