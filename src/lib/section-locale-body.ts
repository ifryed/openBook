import { prisma } from "@/lib/db";

/** Latest revision body per section id for a single locale (first row wins — query is newest-first). */
export async function latestRevisionBodiesForLocale(
  sectionIds: string[],
  locale: string,
): Promise<Map<string, string>> {
  if (sectionIds.length === 0) return new Map();
  const revs = await prisma.revision.findMany({
    where: { sectionId: { in: sectionIds }, locale },
    orderBy: { createdAt: "desc" },
    select: { sectionId: true, body: true },
  });
  const map = new Map<string, string>();
  for (const r of revs) {
    if (!map.has(r.sectionId)) map.set(r.sectionId, r.body);
  }
  return map;
}
