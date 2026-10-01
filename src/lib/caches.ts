/** Service-worker cache holding the model weights. Not private: kept across accounts. */
export const MODEL_CACHE = "detection-model";
/** Service-worker cache holding the signed-in account's scan photos. */
export const SCAN_PHOTO_CACHE = "scan-photos";

export const scanPhotoUrl = (scanId: string) => `/api/scans/${scanId}/image`;

/**
 * Drops the pages and photos the service worker cached for the signed-in
 * account, keeping the app shell and the model weights.
 */
export async function clearPrivateCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => !name.includes("precache") && name !== MODEL_CACHE)
      .map((name) => caches.delete(name)),
  );
}

/**
 * Deletes cached files of models the app no longer uses, which would
 * otherwise take up space on the device indefinitely.
 */
export async function pruneModelCache(keepPrefix: string): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(MODEL_CACHE);
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/models/") && !pathname.startsWith(keepPrefix)) {
      await cache.delete(request);
    }
  }
}

/** Removes deleted scans' photos from the offline cache on this device. */
export async function forgetScanPhotos(scanIds: string[]): Promise<void> {
  if (typeof caches === "undefined" || scanIds.length === 0) return;
  const cache = await caches.open(SCAN_PHOTO_CACHE);
  await Promise.all(scanIds.map((id) => cache.delete(scanPhotoUrl(id))));
}
