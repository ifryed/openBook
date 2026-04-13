import { diffLines } from "diff";

export function DiffView({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const changes = diffLines(oldText, newText);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap">
      {changes.map((part, i) => (
        <span
          key={i}
          className={
            part.added ? "diff-add" : part.removed ? "diff-del" : undefined
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}
