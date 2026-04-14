import {
  INTENDED_AUDIENCE_OPTIONS,
  isKnownIntendedAudience,
} from "@/lib/intended-audience";

type Props = {
  name?: string;
  id?: string;
  required?: boolean;
  defaultValue?: string;
  /** If the book has a legacy free-text value, keep it selectable until migrated. */
  legacyValue?: string | null;
  className?: string;
};

export function IntendedAudienceSelect({
  name = "intendedAges",
  id,
  required,
  defaultValue = "",
  legacyValue,
  className = "mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm",
}: Props) {
  const trimmedLegacy = legacyValue?.trim() ?? "";
  const showLegacy =
    trimmedLegacy.length > 0 && !isKnownIntendedAudience(trimmedLegacy);

  return (
    <select
      name={name}
      id={id}
      required={required}
      defaultValue={defaultValue}
      className={className}
    >
      {!required ? <option value="">Any</option> : null}
      {required ? (
        <option value="" disabled>
          Select age / audience…
        </option>
      ) : null}
      {showLegacy ? (
        <option value={trimmedLegacy}>
          Other (saved value): {trimmedLegacy}
        </option>
      ) : null}
      {INTENDED_AUDIENCE_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
