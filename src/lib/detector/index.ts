import { cocoSsdDetector } from "./cocoSsd";
import type { Detector } from "./types";
import { createYoloDetector } from "./yolo";

// Open Images also labels the scene and the people in it; a room inventory
// only wants the things.
const OPEN_IMAGES_NON_OBJECTS = new Set([
  "House",
  "Building",
  "Furniture",
  "Person",
  "Man",
  "Woman",
  "Boy",
  "Girl",
  "Clothing",
  "Mammal",
  "Animal",
]);

const openImagesDetector = createYoloDetector({
  name: "yolov8n-oiv7",
  modelDir: "/models/yolov8n-oiv7",
  // This model is far less sure of itself than COCO-SSD: at 0.5 it reports
  // almost nothing, so its threshold has to be much lower.
  minConfidence: 0.15,
  ignoreLabel: (label) =>
    OPEN_IMAGES_NON_OBJECTS.has(label) || label.startsWith("Human "),
});

const yoloCocoDetector = createYoloDetector({
  name: "yolov8n-coco",
  modelDir: "/models/yolov8n-coco",
  minConfidence: 0.4,
  // People walk through photos; they aren't part of the room's inventory.
  ignoreLabel: (label) => label === "person",
});

export type DetectorOption = {
  id: string;
  title: string;
  description: string;
  detector: Detector;
};

/** Models the scan page offers. The first is the default. */
export const DETECTORS: DetectorOption[] = [
  {
    id: "coco-ssd",
    title: "Standard",
    description: "80 everyday objects. The smallest and quickest model.",
    detector: cocoSsdDetector,
  },
  {
    id: "yolov8n-coco",
    title: "YOLOv8",
    description:
      "The same 80 everyday objects, found more reliably. Slower to load the first time.",
    detector: yoloCocoDetector,
  },
  {
    id: "yolov8n-oiv7",
    title: "Open Images (experimental)",
    description:
      "About 600 categories, including lamps, shelves and curtains, but less accurate and often unsure.",
    detector: openImagesDetector,
  },
];

export function detectorById(id: string | null): DetectorOption {
  return DETECTORS.find((d) => d.id === id) ?? DETECTORS[0];
}
