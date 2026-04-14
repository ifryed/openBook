import { Link } from "@/i18n/navigation";
import { redirectToLogin } from "@/lib/auth-redirect";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { resolveReport } from "@/app/actions/moderation";
import { prisma } from "@/lib/db";
import { canResolveReports } from "@/lib/moderation";
import { resolveSectionTitle } from "@/lib/section-localization";

type Props = { params: Promise<{ locale: string }> };

export default async function ModerationReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

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

  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      book: { select: { slug: true, title: true } },
      section: {
        select: {
          slug: true,
          localizations: { select: { locale: true, title: true } },
          book: { select: { defaultLocale: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Open reports</h1>
        <p className="mt-1 text-sm text-muted">
          Mark a report resolved after you have reviewed it. You earn a small
          reputation bonus (capped per day).
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-muted">No open reports.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-card p-4 text-sm"
            >
              <p className="text-xs text-muted">
                {r.createdAt.toLocaleString()} · Reported by{" "}
                {r.user.name ?? r.user.email}
              </p>
              {r.book ? (
                <p className="mt-2">
                  <span className="text-muted">Book: </span>
                  <Link
                    href={`/books/${r.book.slug}`}
                    className="font-medium text-foreground no-underline hover:underline"
                  >
                    {r.book.title}
                  </Link>
                  {r.section ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={`/books/${r.book.slug}/${r.section.slug}`}
                        className="text-accent no-underline hover:underline"
                      >
                        {resolveSectionTitle(
                          r.section.slug,
                          r.section.localizations,
                          r.section.book.defaultLocale,
                          r.section.book.defaultLocale,
                        )}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              <blockquote className="mt-3 border-l-2 border-border pl-3 text-foreground">
                {r.reason}
              </blockquote>
              <form action={resolveReport} className="mt-4">
                <input type="hidden" name="reportId" value={r.id} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm !text-white hover:opacity-90"
                >
                  Mark resolved
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
