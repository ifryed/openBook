/**
 * AdSense script and `data-ad-client` must use `ca-pub-…`. Some dashboards copy `pub-…` only.
 */
export function normalizedAdsenseClientId(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("ca-")) return raw;
  if (raw.startsWith("pub-")) return `ca-${raw}`;
  return raw;
}
