"use server";

import { signOut } from "@/auth";
import { getLocale } from "next-intl/server";

export async function signOutAction() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}` });
}
