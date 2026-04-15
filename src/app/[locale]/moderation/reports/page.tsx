import { Link } from "@/i18n/navigation";
import { redirectToLogin } from "@/lib/auth-redirect";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canResolveReports } from "@/lib/moderation";
import type { ReportDisposition } from "@prisma/client";
import { REPORT_DISPOSITION_VALUES } from "@/lib/report-moderation";
import { ClosedReportRow } from "@/components/moderation/closed-report-row";
import { OpenReportModerationCard } from "@/components/moderation/open-report-card";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ queue?: string }>;
};

export default async function ModerationReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { queue } = await searchParams;
  const showClosed = queue === "closed";

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/moderation/reports");
  }

  const allowed = await canResolveReports(session.user.id, {
    isAdmin: session.user.isAdmin,
  });
  if (!allowed) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Moderation</h1>
        <p className="text-muted">
          Report triage is limited to{" "}
          <strong>Steward</strong>-tier contributors (500+ reputation points)
          or <strong>site administrators</strong>.
        </p>
        <p className="text-sm text-muted">
          Keep editing and earning reputation to reach Steward tier, or contact
          an administrator if you need access.
        </p>
      </div>
    );
  }

  const t = await getTranslations("ModerationReports");
  const tLog = await getTranslations("ModerationLog");
  const tDisp = await getTranslations("ReportDispositions");
  const dispositionLabels = Object.fromEntries(
    REPORT_DISPOSITION_VALUES.map((d) => [d, tDisp(d)]),
  ) as Record<ReportDisposition, string>;

  const openInclude = {
    user: { select: { name: true, email: true } },
    book: { select: { slug: true, title: true } },
    section: {
      select: {
        slug: true,
        localizations: { select: { locale: true, title: true } },
        book: { select: { defaultLocale: true } },
      },
    },
    moderationLog: {
      orderBy: { createdAt: "asc" as const },
      include: {
        actor: { select: { name: true, email: true } },
      },
    },
  } as const;

  const [openReports, closedReports] = await Promise.all([
    showClosed
      ? Promise.resolve([])
      : prisma.report.findMany({
          where: { status: "OPEN" },
          orderBy: { createdAt: "desc" },
          include: openInclude,
        }),
    showClosed
      ? prisma.report.findMany({
          where: { status: "RESOLVED" },
          orderBy: { resolvedAt: "desc" },
          take: 40,
          include: {
            resolvedBy: { select: { name: true, email: true } },
            book: { select: { slug: true, title: true } },
            section: {
              select: {
                slug: true,
                localizations: { select: { locale: true, title: true } },
                book: { select: { defaultLocale: true } },
              },
            },
            moderationLog: {
              where: { kind: "DISPOSITION_SET", visibility: "PUBLIC" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const labels = {
    reportedBy: t("reportedBy"),
    reporterMessage: t("reporterMessage"),
    timeline: t("timeline"),
    kindDisposition: tLog("kindDisposition"),
    kindPublicComment: tLog("kindPublicComment"),
    kindReportFiled: tLog("kindReportFiled"),
    kindInternal: t("kindInternal"),
    closeHeading: t("closeHeading"),
    dispositionLabel: t("dispositionLabel"),
    publicSummary: t("publicSummary"),
    publicSummaryHint: t("publicSummaryHint"),
    internalNote: t("internalNote"),
    internalNoteHint: t("internalNoteHint"),
    closeSubmit: t("closeSubmit"),
    commentHeading: t("commentHeading"),
    commentHint: t("commentHint"),
    commentSubmit: t("commentSubmit"),
  };

  const closedLabels = {
    closedAt: t("closedAt"),
    closedBy: t("closedBy"),
    outcome: t("outcome"),
    summary: t("summary"),
    legacyNoDisposition: t("legacyNoDisposition"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/moderation/reports"
          className={`rounded-md px-3 py-1.5 no-underline ${
            !showClosed
              ? "bg-accent !text-white"
              : "border border-border bg-card text-foreground hover:bg-background"
          }`}
        >
          {t("tabOpen")}
        </Link>
        <Link
          href="/moderation/reports?queue=closed"
          className={`rounded-md px-3 py-1.5 no-underline ${
            showClosed
              ? "bg-accent !text-white"
              : "border border-border bg-card text-foreground hover:bg-background"
          }`}
        >
          {t("tabClosed")}
        </Link>
        <Link
          href="/moderation/log"
          className="ml-auto rounded-md border border-border bg-card px-3 py-1.5 text-foreground no-underline hover:bg-background"
        >
          {t("viewPublicLog")}
        </Link>
      </div>

      {showClosed ? (
        closedReports.length === 0 ? (
          <p className="text-muted">{t("noClosed")}</p>
        ) : (
          <ul className="space-y-4">
            {closedReports.map((r) => (
              <ClosedReportRow
                key={r.id}
                report={{
                  id: r.id,
                  resolvedAt: r.resolvedAt,
                  disposition: r.disposition,
                  publicCloseSummary: r.moderationLog[0]?.body ?? null,
                  resolvedBy: r.resolvedBy,
                  book: r.book,
                  section: r.section,
                }}
                labels={closedLabels}
                dispositionLabels={dispositionLabels}
              />
            ))}
          </ul>
        )
      ) : openReports.length === 0 ? (
        <p className="text-muted">{t("noOpen")}</p>
      ) : (
        <ul className="space-y-4">
          {openReports.map((r) => (
            <OpenReportModerationCard
              key={r.id}
              report={{
                id: r.id,
                createdAt: r.createdAt,
                reason: r.reason,
                user: r.user,
                book: r.book,
                section: r.section,
                moderationLog: r.moderationLog.map((e) => ({
                  id: e.id,
                  createdAt: e.createdAt,
                  kind: e.kind,
                  visibility: e.visibility,
                  disposition: e.disposition,
                  body: e.body,
                  actor: e.actor,
                })),
              }}
              labels={labels}
              dispositionLabels={dispositionLabels}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
