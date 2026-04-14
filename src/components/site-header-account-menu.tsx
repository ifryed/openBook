import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { HeaderMenuDetails } from "@/components/header-menu-details";

export function SiteHeaderAccountMenu(props: {
  canResolveReports: boolean;
  isAdmin: boolean;
}) {
  return (
    <HeaderMenuDetails
      menuRole="menu"
      menuClassName="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-md border border-border bg-card py-1 text-sm shadow-md"
    >
      <Link
        href="/profile"
        className="block px-3 py-2 text-foreground no-underline hover:bg-background"
        role="menuitem"
      >
        Profile
      </Link>
      <Link
        href="/settings"
        className="block px-3 py-2 text-foreground no-underline hover:bg-background"
        role="menuitem"
      >
        Settings
      </Link>
      {props.canResolveReports ? (
        <>
          <div className="my-1 border-t border-border" aria-hidden />
          <Link
            href="/moderation/reports"
            className="block px-3 py-2 text-foreground no-underline hover:bg-background"
            role="menuitem"
          >
            Report queue
          </Link>
        </>
      ) : null}
      {props.isAdmin ? (
        <>
          <div className="my-1 border-t border-border" aria-hidden />
          <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
            Administration
          </p>
          <Link
            href="/admin"
            className="block px-3 py-2 text-foreground no-underline hover:bg-background"
            role="menuitem"
          >
            Admin tools
          </Link>
          <Link
            href="/admin/users"
            className="block px-3 py-2 text-foreground no-underline hover:bg-background"
            role="menuitem"
          >
            Users
          </Link>
        </>
      ) : null}
      <form action={signOutAction} className="border-t border-border pt-1">
        <button
          type="submit"
          className="w-full cursor-pointer px-3 py-2 text-left text-foreground hover:bg-background"
          role="menuitem"
        >
          Sign out
        </button>
      </form>
    </HeaderMenuDetails>
  );
}

export function SiteHeaderGuestMenu() {
  return (
    <HeaderMenuDetails menuClassName="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-md border border-border bg-card py-1 text-sm shadow-md">
      <Link
        href="/login"
        className="block px-3 py-2 text-foreground no-underline hover:bg-background"
      >
        Sign in
      </Link>
    </HeaderMenuDetails>
  );
}
