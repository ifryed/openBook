import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-foreground no-underline">
          OpenBook
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-muted no-underline hover:underline">
            Browse
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/books/new"
                className="text-muted no-underline hover:underline"
              >
                New book
              </Link>
              <span className="text-muted">
                {session.user.name ?? session.user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="cursor-pointer text-accent underline-offset-2 hover:underline"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted no-underline hover:underline">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent px-3 py-1.5 !text-white no-underline hover:opacity-90 hover:!text-white"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
