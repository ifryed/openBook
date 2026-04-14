import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateDigestPreference } from "@/app/actions/user-settings";
import { redirectToLogin } from "@/lib/auth-redirect";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

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
    select: { digestOptIn: true },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">{t("notificationsHeading")}</h2>
        <form action={updateDigestPreference} className="mt-4 space-y-4">
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
