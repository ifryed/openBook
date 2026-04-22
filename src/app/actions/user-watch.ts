"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export type UserWatchState = { error?: string; watching?: boolean };

export async function toggleUserWatch(
  watchedUserId: string,
): Promise<UserWatchState> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("signInToWatchUser") };
  }
  if (session.user.id === watchedUserId) {
    return { error: t("cannotWatchSelf") };
  }

  const target = await prisma.user.findUnique({
    where: { id: watchedUserId },
    select: { id: true },
  });
  if (!target) {
    return { error: t("userNotFound") };
  }

  const existing = await prisma.userWatch.findUnique({
    where: {
      watcherId_watchedUserId: {
        watcherId: session.user.id,
        watchedUserId,
      },
    },
  });

  if (existing) {
    await prisma.userWatch.delete({ where: { id: existing.id } });
    revalidatePathLocalized(`/users/${watchedUserId}`);
    revalidatePathLocalized("/profile/watches");
    revalidatePathLocalized("/profile");
    return { watching: false };
  }

  await prisma.userWatch.create({
    data: { watcherId: session.user.id, watchedUserId },
  });
  revalidatePathLocalized(`/users/${watchedUserId}`);
  revalidatePathLocalized("/profile/watches");
  revalidatePathLocalized("/profile");
  return { watching: true };
}

/** Form action: hidden input `watchedUserId`. */
export async function userWatchFormAction(formData: FormData) {
  const watchedUserId = formData.get("watchedUserId")?.toString() ?? "";
  await toggleUserWatch(watchedUserId);
}
