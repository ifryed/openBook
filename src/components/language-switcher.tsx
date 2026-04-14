"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted sm:text-sm">
      <span className="sr-only">{t("ariaLabel")}</span>
      <span className="hidden sm:inline">{t("label")}</span>
      <select
        aria-label={t("ariaLabel")}
        className="max-w-[7rem] rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground sm:max-w-[9rem] sm:text-sm"
        value={locale}
        onChange={(e) => {
          router.replace(pathname, { locale: e.target.value });
        }}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
