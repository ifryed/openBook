import { auth } from "@/auth";
import { redirectToLogin } from "@/lib/auth-redirect";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function DraftsNewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Drafts");

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/drafts/new");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("newIntro")}</p>
      </div>
      <ul className="space-y-3 text-sm">
        <li>
          <Link
            href="/drafts/new/book"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("newBookLink")}
          </Link>
          <p className="mt-0.5 text-muted">{t("newBookHint")}</p>
        </li>
        <li>
          <Link
            href="/drafts/new/chapter"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("newChapterLink")}
          </Link>
          <p className="mt-0.5 text-muted">{t("newChapterHint")}</p>
        </li>
      </ul>
      <p className="text-sm">
        <Link href="/drafts" className="text-accent underline">
          {t("backToList")}
        </Link>
      </p>
    </div>
  );
}
