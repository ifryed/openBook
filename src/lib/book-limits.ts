/** Max sections accepted by addTocSectionsFromLlm (must match server action). */
export const MAX_LLM_TOC_SECTIONS = 15;

/** Intro (optional) + TOC rows in one auto-wizard publish. */
export const MAX_AUTO_WIZARD_PUBLISH_SECTIONS = MAX_LLM_TOC_SECTIONS + 1;
