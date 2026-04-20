import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { hasLocale } from "next-intl";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSenseUnit } from "@/components/adsense-unit";
import { SiteHeader } from "@/components/site-header";
import { isRtlLocale, routing } from "@/i18n/routing";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

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
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const adsenseSlotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim();
  // Head script: Google’s onboarding snippet (publisher id only).
  const adsenseHeadScript = Boolean(adsenseClientId);
  // Visible unit: needs a display ad unit id from AdSense → Ads → By ad unit.
  const adsenseDisplayUnit = Boolean(adsenseClientId && adsenseSlotId);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {adsenseHeadScript ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body
        className={`${inter.variable} ${plexMono.variable} min-h-screen flex flex-col antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <SiteHeader />
            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
              {children}
              {adsenseDisplayUnit ? <AdSenseUnit /> : null}
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
