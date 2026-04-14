import { Link } from "@/i18n/navigation";
import { redirectToLogin } from "@/lib/auth-redirect";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { ProfileReportsList } from "@/components/profile-list-sections";
import {
  PROFILE_REPORTS_LIMIT,
  loadProfileFiledReports,
} from "@/lib/user-profile-data";

type Props = { params: Promise<{ locale: string }> };

export default async function ProfileReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirectToLogin(locale, "/profile/reports");
  }

  const userId = session.user.id;
  const reports = await loadProfileFiledReports(userId, PROFILE_REPORTS_LIMIT);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/profile" className="text-accent no-underline hover:underline">
          ← Back to profile
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold">Reports you filed</h1>
        <p className="mt-1 text-sm text-muted">
          Content reports you submitted, newest first.
        </p>
      </div>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">You have not submitted any reports.</p>
      ) : (
        <>
          <ProfileReportsList reports={reports} />
          {reports.length >= PROFILE_REPORTS_LIMIT ? (
            <p className="text-xs text-muted">
              Showing your {PROFILE_REPORTS_LIMIT} most recent reports.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
