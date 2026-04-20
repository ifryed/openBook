"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const MAX_PUSH_ATTEMPTS = 120;

export function AdSenseUnit() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const slotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim();
  const didPush = useRef(false);

  useEffect(() => {
    if (!clientId || !slotId || didPush.current) return;

    let attempts = 0;
    const tryPush = () => {
      if (didPush.current) return;
      if (window.adsbygoogle) {
        didPush.current = true;
        window.adsbygoogle.push({});
        return;
      }
      if (attempts++ >= MAX_PUSH_ATTEMPTS) return;
      requestAnimationFrame(tryPush);
    };

    tryPush();
  }, [clientId, slotId]);

  if (!clientId || !slotId) return null;

  return (
    <div className="mx-auto mt-8 flex max-h-32 justify-center overflow-hidden">
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
