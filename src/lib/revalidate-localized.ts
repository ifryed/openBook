import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";

/** Revalidate a pathname for every UI locale (path without locale prefix, e.g. `/books/foo`). */
export function revalidatePathLocalized(
  pathWithoutLocale: string,
  type?: "layout" | "page",
) {
  const normalized =
    pathWithoutLocale === "/" || pathWithoutLocale === ""
      ? ""
      : pathWithoutLocale.startsWith("/")
        ? pathWithoutLocale
        : `/${pathWithoutLocale}`;
  for (const loc of routing.locales) {
    const full = normalized ? `/${loc}${normalized}` : `/${loc}`;
    if (type) revalidatePath(full, type);
    else revalidatePath(full);
  }
}
