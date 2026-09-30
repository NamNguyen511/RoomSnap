/** Service-worker cache holding the model weights. Not private: kept across accounts. */
export const MODEL_CACHE = "detection-model";

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
