import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/books/new") return true;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "books") return false;
  // /books/:bookSlug/edit
  if (parts.length === 3 && parts[2] === "edit") return true;
  // /books/:bookSlug/:sectionSlug/edit
  if (parts.length >= 4 && parts[parts.length - 1] === "edit") return true;
  return false;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!req.auth && isProtectedPath(pathname)) {
    const u = new URL("/login", req.nextUrl.origin);
    u.searchParams.set("callbackUrl", pathname);
    return Response.redirect(u);
  }
  return undefined;
});

export const config = {
  matcher: [
    "/books/new",
    "/books/:bookSlug/edit",
    "/books/:bookSlug/:sectionSlug/edit",
  ],
};
