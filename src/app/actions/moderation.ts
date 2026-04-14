"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isUserSteward } from "@/lib/moderation";
import { awardReputationTx } from "@/lib/reputation";

export async function resolveReport(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }

  const steward = await isUserSteward(session.user.id);
  if (!steward) {
    throw new Error("Only Steward-tier contributors can resolve reports.");
  }

  const reportId = formData.get("reportId")?.toString() ?? "";
  if (!reportId) throw new Error("Missing report.");

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { book: { select: { slug: true } } },
  });
  if (!report) throw new Error("Report not found.");
  if (report.status !== "OPEN") {
    throw new Error("This report is already resolved.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: reportId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: session.user!.id,
      },
    });
    await awardReputationTx(tx, session.user!.id, "REPORT_RESOLVED", {
      refReportId: reportId,
      refBookId: report.bookId,
      refSectionId: report.sectionId,
    });
  });

  revalidatePath("/moderation/reports");
  if (report.book?.slug) {
    revalidatePath(`/books/${report.book.slug}`);
  }
}
