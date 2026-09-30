import type { Detection } from "@/lib/detector/types";

/** Everything the server needs to store a scan. */
export type ScanPayload = {
  /** Chosen on the device, so a retried upload can't create a duplicate. */
  id: string;
  roomId: string;
  width: number;
  height: number;
  modelName: string;
  objects: Detection[];
  image: Blob;
};

/** A scan saved on this device because the server couldn't be reached. */
export type PendingScan = ScanPayload & {
  userId: string;
  roomName: string;
  createdAt: string;
  /** Set when the server refused it; it then waits for the user to act. */
  error: string | null;
};

export type PostResult =
  | { kind: "saved"; id: string }
  | { kind: "network" }
  | { kind: "rejected"; status: number; message: string };

/** Fired on `window` whenever the queue changes, so the banner can update. */
export const PENDING_CHANGED = "roomsnap:pending-changed";

const DB_NAME = "roomsnap";
const STORE = "pending-scans";

export function newScanId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs HTTPS; getRandomValues works everywhere.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A rejection worth retrying later, as opposed to one the user must resolve. */
export function isTransient(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

export async function postScan(scan: ScanPayload): Promise<PostResult> {
  const form = new FormData();
  form.set("id", scan.id);
  form.set("roomId", scan.roomId);
  form.set("width", String(scan.width));
  form.set("height", String(scan.height));
  form.set("modelName", scan.modelName);
  form.set("objects", JSON.stringify(scan.objects));
  form.set("image", scan.image, "photo.jpg");

  let res: Response;
  try {
    res = await fetch("/api/scans", { method: "POST", body: form });
  } catch {
    return { kind: "network" };
  }
  const body = await res.json().catch(() => null);
  if (res.ok && typeof body?.id === "string") return { kind: "saved", id: body.id };
  return {
    kind: "rejected",
    status: res.status,
    message: body?.error ?? "The server couldn't save this scan.",
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function announce() {
  window.dispatchEvent(new Event(PENDING_CHANGED));
}

export async function addPending(scan: PendingScan): Promise<void> {
  await withStore("readwrite", (store) => store.put(scan));
  // Ask the browser not to evict unsent scans when storage runs low.
  navigator.storage?.persist?.().catch(() => {});
  announce();
}

/** This account's unsent scans, oldest first. Other accounts' stay hidden. */
export async function listPending(userId: string): Promise<PendingScan[]> {
  const all = await withStore<PendingScan[]>("readonly", (store) => store.getAll());
  return all
    .filter((scan) => scan.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePending(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  announce();
}

export async function setPendingError(
  scan: PendingScan,
  error: string | null,
): Promise<void> {
  await withStore("readwrite", (store) => store.put({ ...scan, error }));
  announce();
}
