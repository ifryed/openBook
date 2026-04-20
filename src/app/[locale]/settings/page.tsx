import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateNotificationSettings } from "@/app/actions/user-settings";
import { redirectToLogin } from "@/lib/auth-redirect";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

const userSettingsSelect = {
  digestOptIn: true,
  emailNotifyMode: true,
  emailFromWatch: true,
  emailFromDigest: true,
  emailFromOwnedBooks: true,
  emailReportUpdates: true,
  emailTypeNewRevision: true,
  emailTypeNewBook: true,
  emailTypeNewSection: true,
  emailTypeRevert: true,
  emailTypeReportPublicComment: true,
  emailTypeReportResolved: true,
} as const;

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Settings");

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/settings");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: userSettingsSelect,
  });

  const mode = user?.emailNotifyMode ?? "OFF";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">{t("notificationsHeading")}</h2>
        <form action={updateNotificationSettings} className="mt-4 space-y-6">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="digestOptIn"
              defaultChecked={user?.digestOptIn ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-foreground">
                {t("digestLabel")}
              </span>
              <span className="mt-1 block text-muted">{t("digestHint")}</span>
            </span>
          </label>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground">
              {t("emailHeading")}
            </h3>
            <p className="mt-1 text-sm text-muted">{t("emailIntro")}</p>

            <div className="mt-4 space-y-3 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="emailNotifyMode"
                  value="OFF"
                  defaultChecked={mode === "OFF"}
                  className="mt-1"
                />
                <span>{t("emailModeNone")}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="emailNotifyMode"
                  value="ALL"
                  defaultChecked={mode === "ALL"}
                  className="mt-1"
                />
                <span>{t("emailModeAll")}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="emailNotifyMode"
                  value="CUSTOM"
                  defaultChecked={mode === "CUSTOM"}
                  className="mt-1"
                />
                <span>{t("emailModeCustom")}</span>
              </label>
            </div>

            <fieldset className="mt-6 space-y-4 rounded-md border border-border/80 p-3">
              <legend className="px-1 text-xs font-medium text-muted">
                {t("emailSourcesHeading")}
              </legend>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="emailFromWatch"
                  defaultChecked={user?.emailFromWatch ?? true}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t("emailSourceWatch")}</span>
                  <span className="mt-0.5 block text-muted text-xs">
                    {t("emailSourceWatchHint")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="emailFromDigest"
                  defaultChecked={user?.emailFromDigest ?? true}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t("emailSourceDigest")}</span>
                  <span className="mt-0.5 block text-muted text-xs">
                    {t("emailSourceDigestHint")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="emailFromOwnedBooks"
                  defaultChecked={user?.emailFromOwnedBooks ?? true}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t("emailSourceOwned")}</span>
                  <span className="mt-0.5 block text-muted text-xs">
                    {t("emailSourceOwnedHint")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="emailReportUpdates"
                  defaultChecked={user?.emailReportUpdates ?? true}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t("emailSourceReports")}</span>
                  <span className="mt-0.5 block text-muted text-xs">
                    {t("emailSourceReportsHint")}
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="mt-4 space-y-3 rounded-md border border-border/80 p-3">
              <legend className="px-1 text-xs font-medium text-muted">
                {t("emailTypesHeading")}
              </legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeNewRevision"
                  defaultChecked={user?.emailTypeNewRevision ?? true}
                />
                {t("emailTypeNewRevision")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeNewBook"
                  defaultChecked={user?.emailTypeNewBook ?? true}
                />
                {t("emailTypeNewBook")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeNewSection"
                  defaultChecked={user?.emailTypeNewSection ?? true}
                />
                {t("emailTypeNewSection")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeRevert"
                  defaultChecked={user?.emailTypeRevert ?? true}
                />
                {t("emailTypeRevert")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeReportPublicComment"
                  defaultChecked={user?.emailTypeReportPublicComment ?? true}
                />
                {t("emailTypeReportPublicComment")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailTypeReportResolved"
                  defaultChecked={user?.emailTypeReportResolved ?? true}
                />
                {t("emailTypeReportResolved")}
              </label>
            </fieldset>
          </div>

          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm !text-white hover:opacity-90"
          >
            {t("savePreferences")}
          </button>
        </form>
      </section>
    </div>
  );
}
