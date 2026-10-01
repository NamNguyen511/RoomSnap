import type { Detector } from "./types";
import { createYoloDetector } from "./yolo";

/**
 * YOLO-World v2 (small). It looks for the words it was exported with: room
 * furniture plus the usual household objects, listed in
 * scripts/export-yolo-world.py. Edit that list and re-export to change what
 * it finds.
 */
export const detector: Detector = createYoloDetector({
  name: "yolo-world-s-room",
  modelDir: "/models/yolo-world-room",
  minConfidence: 0.25,
});
