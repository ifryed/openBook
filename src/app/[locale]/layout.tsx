import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { hasLocale } from "next-intl";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSenseUnit } from "@/components/adsense-unit";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { normalizedAdsenseClientId } from "@/lib/adsense-client-id";
import { routing } from "@/i18n/routing";
import { Providers } from "./providers";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const siteUrl = (
    process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("defaultTitle"),
      template: `%s · OpenBook`,
    },
    description: t("defaultDescription"),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}`]),
      ),
    },
    icons: {
      icon: [{ url: "/branding/openbook-icon.png", type: "image/png" }],
      apple: [{ url: "/branding/openbook-icon.png", type: "image/png" }],
    },
    openGraph: {
      images: [
        {
          url: "/branding/openbook-full-logo.png",
          width: 682,
          height: 1024,
          alt: "OpenBook",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/branding/openbook-full-logo.png"],
    },
  };
}

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const adsenseClientId = normalizedAdsenseClientId();
  const adsenseSlotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim();
  // Visible unit: needs a display ad unit id from AdSense → Ads → By ad unit.
  const adsenseDisplayUnit = Boolean(adsenseClientId && adsenseSlotId);

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          {children}
          {adsenseDisplayUnit ? <AdSenseUnit /> : null}
        </main>
        <SiteFooter />
      </Providers>
    </NextIntlClientProvider>
  );
}
