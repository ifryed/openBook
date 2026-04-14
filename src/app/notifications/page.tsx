import type { NotificationType } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notification-inbox";
import {
  notificationHref,
  notificationSummary,
} from "@/lib/notification-copy";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/notifications");
  }

  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      book: { select: { slug: true, title: true } },
      section: { select: { slug: true, title: true } },
    },
  });

  const watching = items.filter((n) => !n.viaDigest);
  const digest = items.filter((n) => n.viaDigest);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-muted">
            Watching: edits on books you follow. Digest: site-wide activity you
            opted into in{" "}
            <Link href="/settings" className="text-accent no-underline hover:underline">
              settings
            </Link>
            .
          </p>
        </div>
        {items.some((n) => n.readAt === null) ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-background"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Watching</h2>
        {watching.length === 0 ? (
          <p className="text-sm text-muted">
            No notifications yet. Use <strong>Watch</strong> on a book page to
            follow changes.
          </p>
        ) : (
          <ul className="space-y-2">
            {watching.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Digest</h2>
        {digest.length === 0 ? (
          <p className="text-sm text-muted">
            No digest items. Enable “Global activity digest” in settings to see
            updates from books you do not watch.
          </p>
        ) : (
          <ul className="space-y-2">
            {digest.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NotificationRow({
  n,
}: {
  n: {
    id: string;
    type: NotificationType;
    readAt: Date | null;
    createdAt: Date;
    viaDigest: boolean;
    book: { slug: string; title: string } | null;
    section: { slug: string; title: string } | null;
  };
}) {
  const book = n.book;
  const title = book
    ? notificationSummary({
        type: n.type,
        bookTitle: book.title,
        sectionTitle: n.section?.title,
      })
    : "Notification";

  const href = book
    ? notificationHref({
        bookSlug: book.slug,
        sectionSlug: n.section?.slug,
        type: n.type,
      })
    : "/";

  const unread = n.readAt === null;

  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3 ${
        unread ? "bg-card" : "bg-background/60 opacity-90"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {unread ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
          ) : null}
          <Link href={href} className="font-medium text-foreground no-underline hover:underline">
            {title}
          </Link>
          {n.viaDigest ? (
            <span className="rounded bg-border px-1.5 py-0.5 text-xs text-muted">
              Digest
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted">
          {n.createdAt.toLocaleString()}
        </p>
      </div>
      {unread ? (
        <form action={markNotificationRead}>
          <input type="hidden" name="notificationId" value={n.id} />
          <button
            type="submit"
            className="cursor-pointer text-xs text-accent underline-offset-2 hover:underline"
          >
            Mark read
          </button>
        </form>
      ) : null}
    </li>
  );
}
