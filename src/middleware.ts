import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (
    parts.length > 0 &&
    routing.locales.includes(parts[0] as (typeof routing.locales)[number])
  ) {
    parts.shift();
  }
  return "/" + parts.join("/") || "/";
}

function isTermsAllowlistedPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === "/terms" ||
    pathWithoutLocale === "/privacy" ||
    pathWithoutLocale === "/accept-terms" ||
    pathWithoutLocale === "/login" ||
    pathWithoutLocale === "/signup"
  );
}

function isProtectedPath(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === "/books/new") return true;
  if (
    pathWithoutLocale === "/notifications" ||
    pathWithoutLocale === "/settings"
  ) {
    return true;
  }
  if (pathWithoutLocale.startsWith("/profile")) return true;
  if (
    pathWithoutLocale === "/drafts" ||
    pathWithoutLocale.startsWith("/drafts/")
  ) {
    return true;
  }
  if (pathWithoutLocale.startsWith("/moderation")) return true;
  if (pathWithoutLocale.startsWith("/admin")) return true;
  const parts = pathWithoutLocale.split("/").filter(Boolean);
  if (parts[0] !== "books") return false;
  if (parts.length === 3 && parts[2] === "edit") return true;
  if (
    parts.length === 4 &&
    parts[2] === "edit" &&
    parts[3] === "contents"
  ) {
    return true;
  }
  if (
    parts.length === 5 &&
    parts[2] === "edit" &&
    parts[3] === "languages"
  ) {
    return true;
  }
  if (parts.length >= 4 && parts[parts.length - 1] === "edit") return true;
  return false;
}

function localeFromPathname(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (
    parts.length > 0 &&
    routing.locales.includes(parts[0] as (typeof routing.locales)[number])
  ) {
    return parts[0]!;
  }
  return routing.defaultLocale;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Root crawler / verification files must not get a locale prefix (e.g. /en/ads.txt), which breaks AdSense and SEO tools.
  if (
    pathname === "/ads.txt" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse;
  }

  const pathNoLocale = stripLocalePrefix(pathname);

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token && isProtectedPath(pathNoLocale)) {
    const locale = localeFromPathname(pathname);
    const login = new URL(`/${locale}/login`, request.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (
    token &&
    isProtectedPath(pathNoLocale) &&
    token.termsAccepted !== true &&
    !isTermsAllowlistedPath(pathNoLocale)
  ) {
    const locale = localeFromPathname(pathname);
    const accept = new URL(`/${locale}/accept-terms`, request.nextUrl.origin);
    accept.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(accept);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // These live in `public/` with a dot in the path; the catch‑all below skips `.*\..*` so we list them explicitly and short‑circuit above.
    "/ads.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
