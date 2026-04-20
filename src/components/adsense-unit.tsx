"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Wait for head `adsbygoogle.js` (async); can be slower than a few rAF ticks. */
const PUSH_WAIT_MS = 20_000;

export function AdSenseUnit() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const slotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim();
  const didPush = useRef(false);

  useEffect(() => {
    if (!clientId || !slotId || didPush.current) return;

    const started = performance.now();
    const tryPush = () => {
      if (didPush.current) return;
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
    <div className="mx-auto mt-8 flex min-h-[90px] justify-center">
      <ins
        className="adsbygoogle"
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
