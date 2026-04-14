"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const onPointerDown = (e: PointerEvent) => {
      const details = detailsRef.current;
      if (!details) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const hit = target.closest("a[href], button");
      if (hit && panel.contains(hit)) {
        details.open = false;
      }
    };

    panel.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      panel.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-center rounded-md p-2 text-muted hover:bg-background hover:text-foreground [&::-webkit-details-marker]:hidden [&::marker]:hidden"
        aria-label="Account menu"
      >
        <IconMenu className="h-5 w-5" />
      </summary>
      <div ref={panelRef} className={menuClassName} role={menuRole}>
        {children}
      </div>
    </details>
  );
}
