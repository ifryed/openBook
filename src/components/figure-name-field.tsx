"use client";

import { getFigureNameCandidates } from "@/app/actions/figure-verify";
import type { FigureCandidate } from "@/lib/figure-candidates";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";

type ConfirmedPick = {
  canonicalName: string;
  kind: "wikipedia" | "wikidata";
  key: string;
};

type Props = {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  exemptMatch?: string;
  onValidityChange?: (valid: boolean) => void;
};

function candidateLabel(c: FigureCandidate): string {
  return c.source === "wikipedia" ? c.title : `${c.label} (${c.id})`;
}

function candidateDetail(c: FigureCandidate): string {
  if (c.source === "wikipedia") return c.snippet || "—";
  return c.description || "—";
}

export function FigureNameField({
  id,
  name,
  defaultValue = "",
  required = true,
  placeholder,
  exemptMatch,
  onValidityChange,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [candidates, setCandidates] = useState<FigureCandidate[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedPick | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const trimmed = value.trim();
  const exempt =
    exemptMatch !== undefined &&
    trimmed.length > 0 &&
    trimmed === exemptMatch.trim();
  const pickValid =
    confirmed !== null && trimmed === confirmed.canonicalName.trim();
  const valid = exempt || pickValid;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  const runSearch = useCallback(async () => {
    const t = value.trim();
    if (t.length < 2) {
      setActionError("Enter at least two characters.");
      setCandidates(null);
      setSelectedIdx(null);
      setConfirmed(null);
      return;
    }
    setLoading(true);
    setActionError(null);
    setConfirmed(null);
    setSelectedIdx(null);
    const res = await getFigureNameCandidates(t);
    setLoading(false);
    if (!res.ok) {
      setCandidates(null);
      setActionError(res.error);
      return;
    }
    setCandidates(res.candidates);
    if (res.candidates.length === 0) {
      setActionError(
        "No matching real person found — try another spelling or a fuller name.",
      );
    }
  }, [value]);

  const confirmSelection = useCallback(() => {
    if (selectedIdx === null || !candidates || candidates.length === 0) return;
    const c = candidates[selectedIdx];
    if (!c) return;
    if (c.source === "wikipedia") {
      setConfirmed({
        canonicalName: c.title,
        kind: "wikipedia",
        key: c.title,
      });
      setValue(c.title);
    } else {
      setConfirmed({
        canonicalName: c.label,
        kind: "wikidata",
        key: c.id,
      });
      setValue(c.label);
    }
    setActionError(null);
  }, [candidates, selectedIdx]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      if (confirmed && v.trim() !== confirmed.canonicalName.trim()) {
        setConfirmed(null);
        setSelectedIdx(null);
      }
    },
    [confirmed],
  );

  const showCheck = valid;

  return (
    <div className="space-y-2">
      <div className="mt-1 flex items-start gap-2">
        <input
          id={id}
          name={name}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        {showCheck ? (
          <span
            className="mt-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-600/60 text-base font-semibold leading-none text-emerald-600"
            title="Verified"
            aria-label="Figure name verified"
          >
            ✓
          </span>
        ) : (
          <span className="mt-2 h-7 w-7 shrink-0" aria-hidden />
        )}
      </div>

      <input
        type="hidden"
        name="figureVerifiedKind"
        value={confirmed?.kind ?? ""}
        disabled={exempt || !confirmed}
      />
      <input
        type="hidden"
        name="figureVerifiedKey"
        value={confirmed?.key ?? ""}
        disabled={exempt || !confirmed}
      />

      {exempt ? (
        <p className="text-xs text-muted">
          Figure name unchanged — ✓ stays on; you can save other fields without
          picking again.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Before saving, make sure you validated the figure name. The ✓ appears only
          after that; save will be disabled until then.
        </p>
      )}

      {!exempt ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={loading || value.trim().length < 2}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              {loading ? "Searching…" : "Check name"}
            </button>
            <span className="text-xs text-muted">
              {`Non-fictional people only, from Wikipedia + Wikidata.`}
            </span>
          </div>

          {actionError ? (
            <p className="text-xs text-red-700" role="alert">
              {actionError}
            </p>
          ) : null}

          {candidates && candidates.length > 0 ? (
            <fieldset className="space-y-2 rounded-md border border-border bg-card/50 p-3">
              <legend className="px-1 text-xs font-medium text-muted">
                Pick the intended person
              </legend>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {candidates.map((c, i) => (
                  <li key={`${c.source}-${i}-${c.source === "wikipedia" ? c.title : c.id}`}>
                    <label
                      className={`flex cursor-pointer gap-2 rounded-md border p-2 hover:border-border ${
                        selectedIdx === i
                          ? "border-accent/50 bg-muted/25"
                          : "border-transparent"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        checked={selectedIdx === i}
                        onChange={() => setSelectedIdx(i)}
                      />
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="font-medium text-foreground">
                          {c.source === "wikipedia" ? "Wikipedia" : "Wikidata"}
                        </span>
                        <span className="mt-0.5 block text-sm text-foreground">
                          {candidateLabel(c)}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-muted-foreground">
                          {candidateDetail(c)}
                        </span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-accent no-underline hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open in new tab
                        </a>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={confirmSelection}
                disabled={selectedIdx === null}
                className="w-full rounded-md bg-foreground py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Use selected person
              </button>
            </fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
