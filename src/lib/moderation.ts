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
