import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/books/new") return true;
  if (pathname === "/notifications" || pathname === "/settings") {
    return true;
  }
  if (pathname.startsWith("/profile")) return true;
  if (pathname.startsWith("/moderation")) return true;
  if (pathname.startsWith("/admin")) return true;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "books") return false;
  // /books/:bookSlug/edit (book details)
  if (parts.length === 3 && parts[2] === "edit") return true;
  // /books/:bookSlug/edit/contents
  if (
    parts.length === 4 &&
    parts[2] === "edit" &&
    parts[3] === "contents"
  ) {
    return true;
  }
  // /books/:bookSlug/edit/languages/:locale
  if (
    parts.length === 5 &&
    parts[2] === "edit" &&
    parts[3] === "languages"
  ) {
    return true;
  }
  // /books/:bookSlug/:sectionSlug/edit
  if (parts.length >= 4 && parts[parts.length - 1] === "edit") return true;
  return false;
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (!req.auth && isProtectedPath(pathname)) {
    const u = new URL("/login", req.nextUrl.origin);
    const callbackUrl = `${pathname}${search}`;
    u.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(u);
  }
  return undefined;
});

export const config = {
  matcher: [
    "/books/new",
    "/books/:bookSlug/edit",
    "/books/:bookSlug/edit/contents",
    "/books/:bookSlug/edit/languages/:locale",
    "/books/:bookSlug/:sectionSlug/edit",
    "/notifications",
    "/settings",
    "/profile",
    "/profile/:path*",
    "/moderation/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
