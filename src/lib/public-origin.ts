/** Public HTTPS (or dev) origin for links in emails and exports. */
export function getPublicOrigin(): string {
  const raw = process.env.AUTH_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
