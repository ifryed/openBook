"use client";

import { useTranslations } from "next-intl";
import {
  INTENDED_AUDIENCE_OPTIONS,
  isKnownIntendedAudience,
} from "@/lib/intended-audience";

const OPT_KEY: Record<(typeof INTENDED_AUDIENCE_OPTIONS)[number], string> = {
  "0-3": "age0_3",
  "3-8": "age3_8",
  "5-9": "age5_9",
  "6-10": "age6_10",
  "8-12": "age8_12",
  teens: "ageTeens",
  "young adults": "ageYoungAdults",
  adults: "ageAdults",
};

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
  const t = useTranslations("IntendedAudience");
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
      {!required ? <option value="">{t("any")}</option> : null}
      {required ? (
        <option value="" disabled>
          {t("selectPlaceholder")}
        </option>
      ) : null}
      {showLegacy ? (
        <option value={trimmedLegacy}>
          {t("otherLegacy", { value: trimmedLegacy })}
        </option>
      ) : null}
      {INTENDED_AUDIENCE_OPTIONS.map((opt) => {
        const msgKey = OPT_KEY[opt];
        return (
          <option key={opt} value={opt}>
            {t(msgKey)}
          </option>
        );
      })}
    </select>
  );
}
