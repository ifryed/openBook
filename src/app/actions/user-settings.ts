"use server";

import type { EmailNotifyMode, Prisma } from "@prisma/client";
import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

function parseEmailNotifyMode(raw: string | null): EmailNotifyMode {
  if (raw === "ALL" || raw === "CUSTOM") return raw;
  return "OFF";
}

/** Saves digest opt-in and email notification preferences together. */
export async function updateNotificationSettings(formData: FormData) {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("signInRequired"));
  }

  const digestOptIn = formData.get("digestOptIn") === "on";
  const emailNotifyMode = parseEmailNotifyMode(
    formData.get("emailNotifyMode")?.toString() ?? null,
  );

  const data: Prisma.UserUpdateInput = {
    digestOptIn,
    emailNotifyMode,
  };

  if (emailNotifyMode === "CUSTOM") {
    data.emailFromWatch = formData.get("emailFromWatch") === "on";
    data.emailFromDigest = formData.get("emailFromDigest") === "on";
    data.emailFromOwnedBooks = formData.get("emailFromOwnedBooks") === "on";
    data.emailReportUpdates = formData.get("emailReportUpdates") === "on";
    data.emailTypeNewRevision =
      formData.get("emailTypeNewRevision") === "on";
    data.emailTypeNewBook = formData.get("emailTypeNewBook") === "on";
    data.emailTypeNewSection = formData.get("emailTypeNewSection") === "on";
    data.emailTypeRevert = formData.get("emailTypeRevert") === "on";
    data.emailTypeReportPublicComment =
      formData.get("emailTypeReportPublicComment") === "on";
    data.emailTypeReportResolved =
      formData.get("emailTypeReportResolved") === "on";
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  revalidatePathLocalized("/settings");
  revalidatePathLocalized("/", "layout");
}
