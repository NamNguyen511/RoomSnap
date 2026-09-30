import type { Detection } from "./types";

/** Model output: box as [x, y, width, height] in image pixels. */
export type RawDetection = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Converts pixel boxes to fractions of the image, clipped to the image
 * bounds, dropping low-confidence results and boxes with no visible area.
 */
export function toDetections(
  raw: RawDetection[],
  imageWidth: number,
  imageHeight: number,
  minConfidence: number,
): Detection[] {
  const detections: Detection[] = [];
  for (const { bbox, class: label, score } of raw) {
    if (score < minConfidence) continue;
    const [px, py, pw, ph] = bbox;
    const x0 = clamp01(px / imageWidth);
    const y0 = clamp01(py / imageHeight);
    const x1 = clamp01((px + pw) / imageWidth);
    const y1 = clamp01((py + ph) / imageHeight);
    if (x1 <= x0 || y1 <= y0) continue;
    detections.push({
      label,
      confidence: round4(score),
      x: round4(x0),
      y: round4(y0),
      w: round4(x1 - x0),
      h: round4(y1 - y0),
      source: "ai",
    });
  }
  return detections.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}
