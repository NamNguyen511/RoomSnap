import type { Detection } from "@/lib/detector/types";

/** Suggestions when naming an object by hand, including things the model cannot find. */
export const LABEL_SUGGESTIONS = [
  "bed",
  "book",
  "bookshelf",
  "cabinet",
  "chair",
  "clock",
  "couch",
  "curtain",
  "desk",
  "dining table",
  "door",
  "lamp",
  "laptop",
  "microwave",
  "mirror",
  "monitor",
  "oven",
  "picture",
  "pillow",
  "potted plant",
  "refrigerator",
  "rug",
  "shelf",
  "sink",
  "speaker",
  "toilet",
  "tv",
  "vase",
  "wardrobe",
  "window",
];

// Dark enough for white label text on top.
const BOX_COLORS = [
  "#0f766e",
  "#b91c1c",
  "#1d4ed8",
  "#a16207",
  "#7e22ce",
  "#be185d",
  "#15803d",
  "#c2410c",
];

/** A stable colour per label, so every "chair" is drawn the same way. */
export function colorForLabel(label: string): string {
  let hash = 0;
  for (const ch of label.toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return BOX_COLORS[hash % BOX_COLORS.length];
}

/** Label counts, most frequent first, then alphabetical. */
export function countByLabel(
  objects: Pick<Detection, "label">[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { label } of objects) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
