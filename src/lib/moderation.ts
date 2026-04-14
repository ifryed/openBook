import { prisma } from "@/lib/db";
import { tierFromPoints } from "@/lib/reputation";

export async function isUserSteward(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationPoints: true },
  });
  const points = u?.reputationPoints ?? 0;
  return tierFromPoints(points) === "STEWARD";
}

/** Stewards (high reputation) and site administrators may triage the report queue. */
export async function canResolveReports(
  userId: string,
  opts: { isAdmin: boolean },
): Promise<boolean> {
  if (opts.isAdmin) return true;
  return isUserSteward(userId);
}
