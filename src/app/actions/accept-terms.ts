"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export type AcceptTermsState = { error?: string; ok?: boolean };

export async function acceptTermsAction(
  _prev: AcceptTermsState,
  formData: FormData,
): Promise<AcceptTermsState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInRequired") };
  }
  if (session.user.termsAccepted) {
    return { ok: true };
  }
  if (formData.get("acceptTerms") !== "on") {
    return { error: t("acceptTermsRequired") };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date() },
  });

  return { ok: true };
}
