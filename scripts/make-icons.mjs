// Regenerates the PWA icons in public/icons from the SVG below.
// Usage: node scripts/make-icons.mjs   (needs `npx playwright install chromium`)
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BRAND = "#0f766e";

// A camera viewfinder framing a box: "snap a room, outline what's in it".
// `inset` shrinks the artwork so maskable icons survive being cropped to a circle.
const svg = (size, { rounded, inset }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${BRAND}"/>
  <g transform="translate(256 256) scale(${inset}) translate(-256 -256)"
     fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="34">
      <path d="M112 196v-52a32 32 0 0 1 32-32h52"/>
      <path d="M316 112h52a32 32 0 0 1 32 32v52"/>
      <path d="M400 316v52a32 32 0 0 1-32 32h-52"/>
      <path d="M196 400h-52a32 32 0 0 1-32-32v-52"/>
    </g>
    <rect x="200" y="200" width="112" height="112" rx="14" stroke-width="28"/>
  </g>
</svg>`;

const icons = [
  { file: "icon-192.png", size: 192, rounded: true, inset: 1 },
  { file: "icon-512.png", size: 512, rounded: true, inset: 1 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, inset: 0.72 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, inset: 0.9 },
];

await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const { file, size, ...shape } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(size, shape)}`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  await page.close();
  console.log(`public/icons/${file}`);
}
await browser.close();
