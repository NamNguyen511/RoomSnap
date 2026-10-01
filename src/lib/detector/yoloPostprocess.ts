import type { RawDetection } from "./normalize";

/** How an image was scaled and centred into the model's square input. */
export type Letterbox = { scale: number; padX: number; padY: number };

export function letterboxFor(
  imageWidth: number,
  imageHeight: number,
  inputSize: number,
): Letterbox {
  const scale = Math.min(inputSize / imageWidth, inputSize / imageHeight);
  return {
    scale,
    padX: (inputSize - imageWidth * scale) / 2,
    padY: (inputSize - imageHeight * scale) / 2,
  };
}

function iou(a: RawDetection, b: RawDetection): number {
  const [ax, ay, aw, ah] = a.bbox;
  const [bx, by, bw, bh] = b.bbox;
  const overlapW = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const overlapH = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  if (overlapW <= 0 || overlapH <= 0) return 0;
  const intersection = overlapW * overlapH;
  return intersection / (aw * ah + bw * bh - intersection);
}

/**
 * Keeps the most confident box of each overlapping group. Deliberately not
 * per-class: word lists overlap ("table", "desk", "sideboard"), and one
 * object should produce one box.
 */
export function suppressOverlaps(
  detections: RawDetection[],
  iouThreshold: number,
): RawDetection[] {
  const kept: RawDetection[] = [];
  for (const candidate of [...detections].sort((a, b) => b.score - a.score)) {
    if (kept.every((k) => iou(k, candidate) <= iouThreshold)) {
      kept.push(candidate);
    }
  }
  return kept;
}

/**
 * Decodes a YOLOv8 detection head. `output` has shape [4 + classes, anchors],
 * flattened row by row: centre x, centre y, width, height in model-input
 * pixels, then one score per class. Returns boxes in original-image pixels.
 */
export function decodeYoloOutput(
  output: Float32Array,
  anchors: number,
  labels: string[],
  letterbox: Letterbox,
  minConfidence: number,
): RawDetection[] {
  const detections: RawDetection[] = [];
  for (let i = 0; i < anchors; i++) {
    let best = 0;
    let bestClass = -1;
    for (let c = 0; c < labels.length; c++) {
      const score = output[(4 + c) * anchors + i];
      if (score > best) {
        best = score;
        bestClass = c;
      }
    }
    if (best < minConfidence) continue;
    const w = output[2 * anchors + i] / letterbox.scale;
    const h = output[3 * anchors + i] / letterbox.scale;
    const cx = (output[i] - letterbox.padX) / letterbox.scale;
    const cy = (output[anchors + i] - letterbox.padY) / letterbox.scale;
    detections.push({
      bbox: [cx - w / 2, cy - h / 2, w, h],
      class: labels[bestClass],
      score: best,
    });
  }
  return detections;
}
