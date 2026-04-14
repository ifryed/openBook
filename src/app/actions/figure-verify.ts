"use server";

import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import {
  fetchFigureCandidates,
  type FigureCandidate,
} from "@/lib/figure-candidates";

export type FigureCandidatesResult =
  | { ok: true; candidates: FigureCandidate[] }
  | { ok: false; error: string };

/**
 * Returns Wikipedia + Wikidata search hits so the user can pick the intended real
 * person (Wikidata instance of human / Q5 only; fictional entries dropped).
 */
export async function getFigureNameCandidates(
  name: string,
): Promise<FigureCandidatesResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: t("signInRequired") };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: t("figureVerifyChars") };
  }
  if (trimmed.length > 200) {
    return { ok: false, error: t("figureVerifyLong") };
  }

  try {
    const candidates = await fetchFigureCandidates(trimmed);
    return { ok: true, candidates };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : t("figureVerifyFailed"),
    };
  }
}
