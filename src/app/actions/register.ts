"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn } from "@/auth";
import { getLocale, getTranslations } from "next-intl/server";

export type RegisterState = { error?: string };

export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const t = await getTranslations("Errors");
  const name = formData.get("name")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !email.includes("@")) {
    return { error: t("validEmail") };
  }
  if (password.length < 8) {
    return { error: t("passwordLength") };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("emailExists") };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  const locale = await getLocale();
  await signIn("credentials", {
    email,
    password,
    redirectTo: `/${locale}`,
  });

  return {};
}
