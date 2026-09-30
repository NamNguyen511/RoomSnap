"use client";

import { logout } from "@/app/actions";
import { clearPrivateCaches } from "@/lib/caches";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-sm font-medium text-muted underline-offset-4 hover:underline"
      onClick={async () => {
        await clearPrivateCaches().catch(() => {});
        await logout();
      }}
    >
      Log out
    </button>
  );
}
