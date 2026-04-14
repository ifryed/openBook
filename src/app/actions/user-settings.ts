"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function updateDigestPreference(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }

  const digestOptIn = formData.get("digestOptIn") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { digestOptIn },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
