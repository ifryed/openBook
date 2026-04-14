"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function markNotificationRead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const id = formData.get("notificationId")?.toString() ?? "";
  if (!id) return;

  const n = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!n) return;

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  revalidatePathLocalized("/notifications");
  revalidatePathLocalized("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePathLocalized("/notifications");
  revalidatePathLocalized("/", "layout");
}
