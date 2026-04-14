import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Users (admin)" };

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/users");
  }

  if (!session.user.isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted">
          This directory is only available to <strong>site administrators</strong>.
        </p>
        <p className="text-sm text-muted">
          <Link href="/" className="text-accent no-underline hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    );
  }

  const { q: qRaw, page: pageRaw } = await searchParams;
  const q = qRaw?.trim() ?? "";
  let page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);

  const where =
    q.length > 0
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) page = pageCount;

  const skip = (page - 1) * PAGE_SIZE;
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ email: "asc" }],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      reputationPoints: true,
      isAdmin: true,
    },
  });

  const querySuffix = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-muted">
            {total === 0
              ? "No matching accounts."
              : `Showing ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} of ${total}.`}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-accent no-underline hover:underline"
        >
          Admin tools
        </Link>
      </div>

      <form action="/admin/users" method="get" className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="admin-user-q">
          Search by name or email
        </label>
        <input
          id="admin-user-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search name or email…"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? null : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium text-right">Points</th>
                <th className="px-3 py-2 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-2 text-foreground">
                    {u.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted">{u.email}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {u.reputationPoints}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {u.isAdmin ? "Yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          className="flex flex-wrap items-center gap-2 text-sm"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Link
              href={`/admin/users?page=${page - 1}${querySuffix}`}
              className="text-accent no-underline hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span className="text-muted">Previous</span>
          )}
          <span className="text-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={`/admin/users?page=${page + 1}${querySuffix}`}
              className="text-accent no-underline hover:underline"
            >
              Next
            </Link>
          ) : (
            <span className="text-muted">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
