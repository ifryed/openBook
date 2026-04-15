/** Fixed vocabulary for book age / audience (filters, create, edit). */
export const INTENDED_AUDIENCE_OPTIONS = [
  "0-3",
  "3-8",
  "5-9",
  "6-10",
  "8-12",
  "teens",
  "young adults",
  "adults",
] as const;

export type IntendedAudienceOption = (typeof INTENDED_AUDIENCE_OPTIONS)[number];

const SET = new Set<string>(INTENDED_AUDIENCE_OPTIONS);

export function isKnownIntendedAudience(value: string): boolean {
  return SET.has(value.trim());
}
