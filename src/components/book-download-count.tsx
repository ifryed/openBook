import { IconDownload } from "@/components/site-header-icons";
import { getTranslations } from "next-intl/server";

export async function BookDownloadCount({ count }: { count: number }) {
  const t = await getTranslations("Common");
  const label = t("bookDownloadCount", { count });
  return (
    <span
      className="ms-2 inline-flex items-center gap-1 text-sm font-normal tabular-nums text-muted"
      title={label}
      aria-label={label}
    >
      <IconDownload className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span aria-hidden>{count}</span>
    </span>
  );
}
