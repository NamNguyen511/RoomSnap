import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The service worker is only built for production; dev stays uncached.
  disable: process.env.NODE_ENV !== "production",
  // Reloading when the connection returns would throw away a scan that is
  // waiting to be saved.
  reloadOnOnline: false,
  // Setting this replaces Serwist's default of precaching everything in
  // public/. That is deliberate: the model weights are cached on first use
  // instead (see sw.ts), so installing the app doesn't pull 18 MB up front.
  additionalPrecacheEntries: [{ url: "/~offline", revision: randomUUID() }],
});

const nextConfig: NextConfig = {
  // The end-to-end tests build into their own folder, so they can run while
  // `npm run dev` is using .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withSerwist(nextConfig);
