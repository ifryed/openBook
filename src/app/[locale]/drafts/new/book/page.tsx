import { createBookDraftAction } from "@/app/actions/content-drafts";
import { BookDraftForm } from "@/components/book-draft-form";
import { auth } from "@/auth";
import { redirectToLogin } from "@/lib/auth-redirect";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function NewBookDraftPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Drafts");

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/drafts/new/book");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("newBookPageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("newBookPageIntro")}</p>
      </div>
      <BookDraftForm
        mode="create"
        formAction={createBookDraftAction}
        submitLabel={t("saveDraft")}
        submitPendingLabel={t("savingDraft")}
      />
      <p className="text-sm text-muted">
        <Link href="/drafts/new" className="text-accent underline">
          {t("backNewHub")}
        </Link>
        {" · "}
        <Link href="/drafts" className="text-accent underline">
          {t("backToList")}
        </Link>
      </p>
    </div>
  );
}
