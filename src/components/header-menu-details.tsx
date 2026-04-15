"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { IconMenu } from "@/components/site-header-icons";

type Props = {
  children: ReactNode;
  menuClassName: string;
  menuRole?: "menu";
};

export function HeaderMenuDetails({
  children,
  menuClassName,
  menuRole,
}: Props) {
  const t = useTranslations("SiteHeader");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDownOutside = (e: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (details.contains(target)) return;
      details.open = false;
    };

    document.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const onClick = (e: MouseEvent) => {
      const details = detailsRef.current;
      if (!details) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const hit = target.closest("a[href], button");
      if (hit && panel.contains(hit)) {
        details.open = false;
      }
    };

    const onChange = (e: Event) => {
      const details = detailsRef.current;
      if (!details) return;
      const target = e.target;
      if (target instanceof HTMLSelectElement && panel.contains(target)) {
        details.open = false;
      }
    };

    panel.addEventListener("click", onClick);
    panel.addEventListener("change", onChange);
    return () => {
      panel.removeEventListener("click", onClick);
      panel.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-center rounded-md p-2 text-muted hover:bg-background hover:text-foreground [&::-webkit-details-marker]:hidden [&::marker]:hidden"
        aria-label={t("accountMenu")}
      >
        <IconMenu className="h-5 w-5" />
      </summary>
      <div ref={panelRef} className={menuClassName} role={menuRole}>
        {children}
      </div>
    </details>
  );
}
