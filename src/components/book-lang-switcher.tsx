"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { bookLocaleLabel } from "@/lib/book-locales";

type Props = {
  locales: string[];
  activeLocale: string;
};

export function BookLangSwitcher({ locales, activeLocale }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (locales.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Language:</span>
      <ul className="flex flex-wrap gap-1">
        {locales.map((loc) => {
          const q = new URLSearchParams(searchParams.toString());
          q.set("lang", loc);
          const href = `${pathname}?${q.toString()}`;
          const on = loc === activeLocale;
          return (
            <li key={loc}>
              {on ? (
                <span className="rounded-md bg-muted px-2 py-1 font-medium">
                  {bookLocaleLabel(loc)}
                </span>
              ) : (
                <Link
                  href={href}
                  className="rounded-md px-2 py-1 text-accent no-underline hover:underline"
                >
                  {bookLocaleLabel(loc)}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
