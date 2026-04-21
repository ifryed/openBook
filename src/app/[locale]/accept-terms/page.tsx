import type { Metadata } from "next";
import { auth } from "@/auth";
import { AcceptTermsForm } from "./accept-terms-form";
import { localizedCallbackUrl } from "@/lib/localized-callback-url";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AcceptTerms" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AcceptTermsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const session = await auth();

  const acceptPath = `/${locale}/accept-terms`;
  const query = new URLSearchParams();
  if (sp.callbackUrl) {
    query.set("callbackUrl", sp.callbackUrl);
  }
  const acceptPathWithQuery =
    query.size > 0 ? `${acceptPath}?${query.toString()}` : acceptPath;

  if (!session?.user?.id) {
    redirect(
      `/${locale}/login?callbackUrl=${encodeURIComponent(acceptPathWithQuery)}`,
    );
  }

  const afterAccept = localizedCallbackUrl(sp.callbackUrl, locale);

  if (session.user.termsAccepted) {
    redirect(afterAccept);
  }

  const t = await getTranslations("AcceptTerms");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <AcceptTermsForm callbackUrl={afterAccept} />
    </div>
  );
}
