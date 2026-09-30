import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import { MODEL_CACHE } from "@/lib/caches";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Model weights and the ONNX runtime: kept once downloaded so detection
    // works offline. Only the models actually used are fetched.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && /^\/(models|ort)\//.test(url.pathname),
      handler: new CacheFirst({ cacheName: MODEL_CACHE }),
    },
    // Scan photos never change, so saved scans can be viewed offline.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && /^\/api\/scans\/[^/]+\/image$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "scan-photos",
        plugins: [new ExpirationPlugin({ maxEntries: 60 })],
      }),
    },
    // Everything else under /api (saving, exports, auth) must be live.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
