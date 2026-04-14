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

function isProtectedPath(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === "/books/new") return true;
  if (
    pathWithoutLocale === "/notifications" ||
    pathWithoutLocale === "/settings"
  ) {
    return true;
  }
  if (pathWithoutLocale.startsWith("/profile")) return true;
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
  const intlResponse = intlMiddleware(request);
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse;
  }

  const pathname = request.nextUrl.pathname;
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

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
