"use server";

import { auth } from "@/auth";
import {
  fetchFigureCandidates,
  type FigureCandidate,
} from "@/lib/figure-candidates";

export type FigureCandidatesResult =
  | { ok: true; candidates: FigureCandidate[] }
  | { ok: false; error: string };

/**
 * Returns Wikipedia + Wikidata search hits so the user can pick the intended person.
 */
export async function getFigureNameCandidates(
  name: string,
): Promise<FigureCandidatesResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Enter at least two characters." };
  }
  if (trimmed.length > 200) {
    return { ok: false, error: "Name is too long." };
  }

  try {
    const candidates = await fetchFigureCandidates(trimmed);
    return { ok: true, candidates };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not load name suggestions. Try again.",
    };
  }
}
