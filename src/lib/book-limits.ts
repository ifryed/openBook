/**
 * Soft cap per batch (add TOC from LLM, wizard publish). Stops pathological
 * payloads; the UI does not advertise a maximum. Rate limits still apply.
 */
export const MAX_LLM_TOC_SECTIONS = 2000;

/** Intro (optional) + TOC rows in one auto-wizard publish. */
export const MAX_AUTO_WIZARD_PUBLISH_SECTIONS = MAX_LLM_TOC_SECTIONS + 1;
