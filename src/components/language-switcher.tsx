"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  /** Compact inline header (default) vs block inside header dropdown menus */
  variant?: "header" | "menu";
};

export function LanguageSwitcher({ variant = "header" }: Props) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const select = (
    <select
      aria-label={t("ariaLabel")}
      className={
        variant === "menu"
          ? "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          : "max-w-[7rem] rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground sm:max-w-[9rem] sm:text-sm"
      }
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
  );

  if (variant === "menu") {
    return (
      <div className="px-3 py-2" role="presentation">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{t("label")}</span>
          {select}
        </label>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted sm:text-sm">
      <span className="sr-only">{t("ariaLabel")}</span>
      <span className="hidden sm:inline">{t("label")}</span>
      {select}
    </label>
  );
}
