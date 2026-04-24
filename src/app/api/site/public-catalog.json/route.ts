import { buildPublicCatalogSnapshot } from "@/lib/public-catalog-snapshot";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const snapshot = await buildPublicCatalogSnapshot();
  return Response.json(snapshot, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
