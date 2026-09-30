"use client";

import { logout } from "@/app/actions";
import { clearPrivateCaches } from "@/lib/caches";
import { listPending, removePending } from "@/lib/pendingScans";

export function LogoutButton({ userId }: { userId: string }) {
  async function handleClick() {
    // Unsent scans hold this account's photos, so they can't outlive the session.
    const pending = await listPending(userId).catch(() => []);
    if (pending.length > 0) {
      const count =
        pending.length === 1 ? "1 scan hasn't" : `${pending.length} scans haven't`;
      const proceed = window.confirm(
        `${count} uploaded yet and will be deleted from this device if you log out. Log out anyway?`,
      );
      if (!proceed) return;
      await Promise.all(pending.map((scan) => removePending(scan.id))).catch(
        () => {},
      );
    }
    await clearPrivateCaches().catch(() => {});
    await logout();
  }

  return (
    <button
      type="button"
      className="text-sm font-medium text-muted underline-offset-4 hover:underline"
      onClick={handleClick}
    >
      Log out
    </button>
  );
}
