"use client";

import { useRouter } from "next/navigation";
import type { Detection } from "@/lib/detector/types";
import { ScanEditor } from "./ScanEditor";

type Props = { scanId: string; objects: Detection[] };

/** A saved scan: same editor as a new scan, saving edits back to the server. */
export function SavedScan({ scanId, objects }: Props) {
  const router = useRouter();

  async function save(edited: Detection[]): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch(`/api/scans/${scanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects: edited }),
      });
    } catch {
      return navigator.onLine
        ? "Couldn't reach the server. Try again."
        : "You're offline. Reconnect to save your changes.";
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't save your changes. Try again.";
    }
    router.refresh();
    return null;
  }

  return (
    <ScanEditor
      imageSrc={`/api/scans/${scanId}/image`}
      initialObjects={objects}
      saveLabel="Save changes"
      requireChanges
      onSave={save}
    />
  );
}
