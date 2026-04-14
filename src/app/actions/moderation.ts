"use server";

import { revalidatePathLocalized } from "@/lib/revalidate-localized";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canResolveReports } from "@/lib/moderation";
import { awardReputationTx } from "@/lib/reputation";
import { getTranslations } from "next-intl/server";

export async function resolveReport(formData: FormData) {
  const t = await getTranslations("Errors");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("signInRequired"));
  }

  const allowed = await canResolveReports(session.user.id, {
    isAdmin: session.user.isAdmin,
  });
  if (!allowed) {
    throw new Error(t("onlyStewardResolve"));
  }

  const reportId = formData.get("reportId")?.toString() ?? "";
  if (!reportId) throw new Error(t("missingReport"));

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { book: { select: { slug: true } } },
  });
  if (!report) throw new Error(t("reportNotFound"));
  if (report.status !== "OPEN") {
    throw new Error(t("reportAlreadyResolved"));
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

  revalidatePathLocalized("/moderation/reports");
  if (report.book?.slug) {
    revalidatePathLocalized(`/books/${report.book.slug}`);
  }
}
