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
  dir = "ltr",
  className,
}: {
  tocHref: string;
  tocLabel: string;
  previousChapterLabel: string;
  nextChapterLabel: string;
  ariaLabel: string;
  previous: ChapterNavLink | null;
  next: ChapterNavLink | null;
  /** Book reading direction (`?lang=`); controls layout and prev/next arrows in RTL. */
  dir?: "ltr" | "rtl";
  className?: string;
}) {
  const prevArrow = dir === "rtl" ? "→" : "←";
  const nextArrow = dir === "rtl" ? "←" : "→";

  return (
    <nav
      aria-label={ariaLabel}
      dir={dir}
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
              <span className="mt-0.5 inline-flex max-w-full flex-row flex-nowrap items-baseline gap-3 font-medium leading-snug group-hover:underline">
                <span aria-hidden className="shrink-0 select-none">
                  {prevArrow}
                </span>
                <span className="min-w-0">{previous.title}</span>
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
              <span className="mt-0.5 inline-flex max-w-full flex-row flex-nowrap items-baseline gap-3 font-medium leading-snug group-hover:underline">
                <span className="min-w-0">{next.title}</span>
                <span aria-hidden className="shrink-0 select-none">
                  {nextArrow}
                </span>
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
