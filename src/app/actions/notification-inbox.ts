"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
