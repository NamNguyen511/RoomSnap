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

/** Removes deleted scans' photos from the offline cache on this device. */
export async function forgetScanPhotos(scanIds: string[]): Promise<void> {
  if (typeof caches === "undefined" || scanIds.length === 0) return;
  const cache = await caches.open(SCAN_PHOTO_CACHE);
  await Promise.all(scanIds.map((id) => cache.delete(scanPhotoUrl(id))));
}
