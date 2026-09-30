import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { PendingScans } from "@/components/PendingScans";
import { requireUserId } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await requireUserId();

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/rooms"
            className="text-lg font-bold tracking-tight text-accent"
          >
            RoomSnap
          </Link>
          <LogoutButton userId={userId} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <PendingScans userId={userId} />
        {children}
      </main>
    </>
  );
}
