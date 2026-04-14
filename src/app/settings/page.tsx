import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateDigestPreference } from "@/app/actions/user-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { digestOptIn: true },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Control how you hear about activity across OpenBook.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Notifications</h2>
        <form action={updateDigestPreference} className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="digestOptIn"
              defaultChecked={user?.digestOptIn ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-foreground">
                Global activity digest
              </span>
              <span className="mt-1 block text-muted">
                Get in-app notifications for new books and edits on books you
                are not watching. Books you watch always notify you directly.
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm !text-white hover:opacity-90"
          >
            Save preferences
          </button>
        </form>
      </section>
    </div>
  );
}
