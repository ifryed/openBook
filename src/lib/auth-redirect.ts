import { redirect } from "next/navigation";

/** Path without locale prefix, e.g. `/settings` or `/profile/watches`. */
export function redirectToLogin(locale: string, pathWithoutLocale: string): never {
  const p = pathWithoutLocale.startsWith("/")
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;
  redirect(
    `/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}${p}`)}`,
  );
}
