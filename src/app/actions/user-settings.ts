"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export async function updateDigestPreference(formData: FormData) {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("signInRequired"));
  }

  const digestOptIn = formData.get("digestOptIn") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { digestOptIn },
  });

  revalidatePathLocalized("/settings");
  revalidatePathLocalized("/", "layout");
}
