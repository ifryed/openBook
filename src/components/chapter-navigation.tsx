import { Link } from "@/i18n/navigation";

export type ChapterNavLink = { href: string; title: string };

export function ChapterNavigation({
  tocHref,
  tocLabel,
  previousChapterLabel,
  nextChapterLabel,
  ariaLabel,
  previous,
  next,
  className,
}: {
  tocHref: string;
  tocLabel: string;
  previousChapterLabel: string;
  nextChapterLabel: string;
  ariaLabel: string;
  previous: ChapterNavLink | null;
  next: ChapterNavLink | null;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[
        "rounded-lg border border-border bg-card/60 px-4 py-3 text-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 sm:max-w-[38%]">
          {previous ? (
            <Link
              href={previous.href}
              className="group block no-underline text-foreground hover:text-accent"
            >
              <span className="block text-xs text-muted">
                {previousChapterLabel}
              </span>
              <span className="mt-0.5 block font-medium leading-snug group-hover:underline">
                ← {previous.title}
              </span>
            </Link>
          ) : (
            <p className="text-muted">
              <span className="block text-xs">{previousChapterLabel}</span>
              <span className="mt-0.5 block">—</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-center sm:pt-1">
          <Link
            href={tocHref}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted/50"
          >
            {tocLabel}
          </Link>
        </div>

        <div className="min-w-0 flex-1 text-end sm:max-w-[38%]">
          {next ? (
            <Link
              href={next.href}
              className="group block no-underline text-foreground hover:text-accent"
            >
              <span className="block text-xs text-muted">
                {nextChapterLabel}
              </span>
              <span className="mt-0.5 block font-medium leading-snug group-hover:underline">
                {next.title} →
              </span>
            </Link>
          ) : (
            <p className="text-muted">
              <span className="block text-xs">{nextChapterLabel}</span>
              <span className="mt-0.5 block">—</span>
            </p>
          )}
        </div>
      </div>
    </nav>
  );
}
