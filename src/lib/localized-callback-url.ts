import { routing } from "@/i18n/routing";

/** Ensure post-login redirect stays within a valid UI locale prefix. */
export function localizedCallbackUrl(
  callbackUrl: string | undefined,
  locale: string,
): string {
  const def = `/${locale}`;
  if (!callbackUrl?.startsWith("/") || callbackUrl.startsWith("//")) {
    return def;
  }
  const parts = callbackUrl.split("/").filter(Boolean);
  if (
    parts[0] &&
    routing.locales.includes(parts[0] as (typeof routing.locales)[number])
  ) {
    return callbackUrl;
  }
  return callbackUrl === "/" ? def : `/${locale}${callbackUrl}`;
}
