import type { ObjectDetection } from "@tensorflow-models/coco-ssd";
import { toDetections } from "./normalize";
import type { Detector, DetectorBackend } from "./types";

// Weights are self-hosted (public/models) so the service worker can cache
// them and detection keeps working offline.
const MODEL_URL = "/models/coco-ssd/model.json";
const MIN_CONFIDENCE = 0.5;
const MAX_BOXES = 40;

let modelPromise: Promise<ObjectDetection> | null = null;
let backend: DetectorBackend | null = null;

async function loadModel(): Promise<ObjectDetection> {
  // Imported lazily: TensorFlow.js is large and only needed on the scan page.
  const tf = await import("@tensorflow/tfjs");
  const webgl = await tf.setBackend("webgl").catch(() => false);
  if (!webgl) await tf.setBackend("cpu");
  await tf.ready();
  const cocoSsd = await import("@tensorflow-models/coco-ssd");
  const model = await cocoSsd.load({
    base: "lite_mobilenet_v2",
    modelUrl: MODEL_URL,
  });
  backend = tf.getBackend() === "webgl" ? "gpu" : "cpu";
  return model;
}

function getModel(): Promise<ObjectDetection> {
  if (!modelPromise) {
    modelPromise = loadModel().catch((err) => {
      modelPromise = null; // allow a retry after a failed download
      throw err;
    });
  }
  return modelPromise;
}

export const cocoSsdDetector: Detector = {
  name: "coco-ssd/lite_mobilenet_v2",
  get backend() {
    return backend;
  },
  async load() {
    await getModel();
  },
  async detect(image) {
    const model = await getModel();
    const raw = await model.detect(image, MAX_BOXES, MIN_CONFIDENCE);
    return toDetections(raw, image.width, image.height, MIN_CONFIDENCE);
  },
};
