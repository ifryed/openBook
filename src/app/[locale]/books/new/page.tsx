import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreateBookForm } from "./create-book-form";

type Props = { params: Promise<{ locale: string }> };

export default async function NewBookPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("NewBook");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          <Link href="/books/new/auto" className="text-accent underline">
            {t("autoGenLink")}
          </Link>
          {" — "}
          {t("autoGenDescription")}
        </p>
        <p className="mt-1 text-sm text-muted">
          <Link href="/drafts/import/book" className="text-accent underline">
            {t("importJsonLink")}
          </Link>
          {" — "}
          {t("importJsonDescription")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("figureFocusBlurb")}</p>
      </div>
      <CreateBookForm />
      <p className="text-sm text-muted">
        <Link href="/">{t("backBrowse")}</Link>
      </p>
    </div>
  );
}
