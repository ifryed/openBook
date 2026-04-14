import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata = { title: "Admin tools" };

export default async function AdminHubPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!session.user.isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Admin tools</h1>
        <p className="text-muted">
          This area is only available to <strong>site administrators</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin tools</h1>
        <p className="mt-1 text-sm text-muted">
          Shortcuts for site administration (similar in spirit to Wikipedia’s
          Special pages).
        </p>
      </div>

      <ul className="space-y-2 text-sm">
        <li>
          <Link
            href="/admin/users"
            className="text-accent no-underline hover:underline"
          >
            Users
          </Link>
          <span className="text-muted"> — directory and search</span>
        </li>
        <li>
          <Link
            href="/moderation/reports"
            className="text-accent no-underline hover:underline"
          >
            Report queue
          </Link>
          <span className="text-muted"> — open content reports</span>
        </li>
      </ul>

      <p className="text-sm text-muted">
        To permanently delete a book and all of its history, use the admin
        section on that book’s edit page.
      </p>
    </div>
  );
}
