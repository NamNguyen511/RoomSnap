"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTransient,
  listPending,
  PENDING_CHANGED,
  type PendingScan,
  postScan,
  removePending,
  setPendingError,
} from "@/lib/pendingScans";
import { LocalTime } from "./LocalTime";

// navigator.onLine can stay "online" on a dead connection, so also retry on a timer.
const RETRY_INTERVAL_MS = 30_000;

function Thumbnail({ image }: { image: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(image);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  if (!url) return <div className="size-14 shrink-0 rounded-lg bg-accent-soft" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob: source
    <img src={url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
  );
}

/**
 * Scans saved on this device while offline: lists them and uploads them
 * whenever the server can be reached again.
 */
export function PendingScans({ userId }: { userId: string }) {
  const router = useRouter();
  const [scans, setScans] = useState<PendingScan[]>([]);
  const [uploading, setUploading] = useState(false);
  const [online, setOnline] = useState(true);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    setScans(await listPending(userId).catch(() => []));
  }, [userId]);

  const upload = useCallback(
    async (includeRejected: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setUploading(true);
      let uploadedAny = false;
      try {
        for (const scan of await listPending(userId)) {
          // A refused scan waits for the user to retry or discard it.
          if (scan.error && !includeRejected) continue;
          const result = await postScan(scan);
          if (result.kind === "saved") {
            await removePending(scan.id);
            uploadedAny = true;
          } else if (result.kind === "network" || isTransient(result.status)) {
            break; // still unreachable, or logged out: try again later
          } else {
            await setPendingError(scan, result.message);
          }
        }
      } catch {
        // Storage unavailable; nothing to upload from here.
      } finally {
        busy.current = false;
        setUploading(false);
        await refresh();
        if (uploadedAny) router.refresh();
      }
    },
    [userId, refresh, router],
  );

  useEffect(() => {
    const tryUpload = () => {
      setOnline(navigator.onLine);
      refresh();
      if (navigator.onLine) upload(false);
    };
    const whenVisible = () => {
      if (!document.hidden) tryUpload();
    };
    tryUpload();
    window.addEventListener("online", tryUpload);
    window.addEventListener("offline", tryUpload);
    window.addEventListener(PENDING_CHANGED, tryUpload);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      window.removeEventListener("online", tryUpload);
      window.removeEventListener("offline", tryUpload);
      window.removeEventListener(PENDING_CHANGED, tryUpload);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [refresh, upload]);

  const waiting = scans.length > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => upload(false), RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [waiting, upload]);

  if (!waiting) return null;

  const rejected = scans.filter((scan) => scan.error).length;
  const status = !online
    ? "Saved on this device. They'll upload when you're back online."
    : uploading
      ? "Uploading…"
      : rejected > 0
        ? "Some couldn't be uploaded. See below."
        : "Saved on this device until the upload finishes.";

  return (
    <section className="card flex flex-col gap-3 p-4" data-testid="pending-scans">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">
            {scans.length} {scans.length === 1 ? "scan" : "scans"} waiting to
            upload
          </h2>
          <p className="text-sm text-muted" role="status">
            {status}
          </p>
        </div>
        <button
          type="button"
          className="btn shrink-0"
          disabled={uploading || !online}
          onClick={() => upload(true)}
        >
          Upload now
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {scans.map((scan) => (
          <li key={scan.id} className="flex items-center gap-3">
            <Thumbnail image={scan.image} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{scan.roomName}</p>
              <p className="text-muted">
                <LocalTime iso={scan.createdAt} /> · {scan.objects.length}{" "}
                {scan.objects.length === 1 ? "object" : "objects"}
              </p>
              {scan.error && (
                <p role="alert" className="text-danger">
                  {scan.error}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-danger shrink-0"
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this scan? It hasn't been uploaded and can't be recovered.",
                  )
                ) {
                  removePending(scan.id).catch(() => {});
                }
              }}
            >
              Discard
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
