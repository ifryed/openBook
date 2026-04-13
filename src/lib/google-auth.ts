/** True when Google OAuth env vars are set (server-only). */
export function isGoogleAuthEnabled(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}
