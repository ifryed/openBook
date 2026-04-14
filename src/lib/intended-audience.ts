/** Fixed vocabulary for book age / audience (filters, create, edit). */
export const INTENDED_AUDIENCE_OPTIONS = [
  "0-3",
  "3-4",
  "4-6",
  "6-8",
  "8-10",
  "10-3",
  "teens",
  "young adults",
  "adults",
] as const;

export type IntendedAudienceOption = (typeof INTENDED_AUDIENCE_OPTIONS)[number];

const SET = new Set<string>(INTENDED_AUDIENCE_OPTIONS);

export function isKnownIntendedAudience(value: string): boolean {
  return SET.has(value.trim());
}
