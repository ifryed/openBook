"use client";

import { useEffect, useRef } from "react";
import { normalizedAdsenseClientId } from "@/lib/adsense-client-id";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Wait for head `adsbygoogle.js` (async); can be slower than a few rAF ticks. */
const PUSH_WAIT_MS = 20_000;

export function AdSenseUnit() {
  const clientId = normalizedAdsenseClientId();
  const slotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim();
  const didPush = useRef(false);
  const insRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!clientId || !slotId || didPush.current) return;

    const started = performance.now();
    const tryPush = () => {
      if (didPush.current) return;
      const ins = insRef.current;
      // AdSense needs a non-zero slot width; an empty <ins> as a flex item can be 0px wide.
      if (!ins || ins.offsetWidth <= 0) {
        if (performance.now() - started >= PUSH_WAIT_MS) return;
        requestAnimationFrame(tryPush);
        return;
      }
      if (window.adsbygoogle) {
        didPush.current = true;
        window.adsbygoogle.push({});
        return;
      }
      if (performance.now() - started >= PUSH_WAIT_MS) return;
      requestAnimationFrame(tryPush);
    };

    tryPush();
  }, [clientId, slotId]);

  if (!clientId || !slotId) return null;

  return (
    <div className="mx-auto mt-8 flex min-h-[90px] w-full max-w-full justify-center">
      <ins
        ref={insRef}
        className="adsbygoogle block w-full max-w-full min-w-0"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
        aria-label="Advertisement"
      />
    </div>
  );
}
