// Copies the ONNX Runtime Web files the YOLO detector loads at run time into
// public/ort, so they are served (and cached for offline use) by the app
// itself rather than a CDN. Runs on `npm install`.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FILES = [
  "ort.wasm.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

const from = path.resolve("node_modules/onnxruntime-web/dist");
const to = path.resolve("public/ort");

await mkdir(to, { recursive: true });
await Promise.all(
  FILES.map((file) => copyFile(path.join(from, file), path.join(to, file))),
);
