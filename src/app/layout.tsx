import { IBM_Plex_Mono, Inter } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { isRtlLocale } from "@/i18n/routing";
import { normalizedAdsenseClientId } from "@/lib/adsense-client-id";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const adsenseClientId = normalizedAdsenseClientId();
  const adsenseHeadScript = Boolean(adsenseClientId);

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
        {children}
      </body>
    </html>
  );
}
