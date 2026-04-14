"use server";

import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { gatherReferenceSnippetsMarkdown } from "@/lib/reference-lookup";

export type DraftReferenceLookupResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

/**
 * Pulls short snippets from Wikipedia, Wikidata, and Open Library for draft prompts.
 * Requires a signed-in user (same as editing).
 */
export async function fetchDraftReferenceContext(input: {
  guides: string;
  figureName: string;
  sectionTitle: string;
}): Promise<DraftReferenceLookupResult> {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: t("signInForReferences") };
  }

  try {
    const markdown = await gatherReferenceSnippetsMarkdown(input);
    return { ok: true, markdown };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : t("referenceLookupFailed"),
    };
  }
}
