import type { InferenceSession } from "onnxruntime-web";
import { toDetections } from "./normalize";
import type { Detector } from "./types";
import {
  decodeYoloOutput,
  letterboxFor,
  suppressOverlaps,
} from "./yoloPostprocess";

type Ort = typeof import("onnxruntime-web");

// Served from public/ort (see scripts/copy-ort.mjs) and loaded at run time,
// outside the bundle, so the service worker can cache the runtime for offline use.
const ORT_DIR = "/ort/";
const INPUT_SIZE = 640;
const PAD_COLOR = "rgb(114, 114, 114)"; // the grey YOLO models are trained with
const IOU_THRESHOLD = 0.6;

export type YoloConfig = {
  /** Stored with each scan. */
  name: string;
  /** Folder holding model.onnx and labels.json (array indexed by class id). */
  modelDir: string;
  minConfidence: number;
  /** Labels to drop, e.g. ones describing the scene rather than an object. */
  ignoreLabel?: (label: string) => boolean;
};

let ortPromise: Promise<Ort> | null = null;

function loadOrt(): Promise<Ort> {
  if (!ortPromise) {
    const url = `${ORT_DIR}ort.wasm.min.mjs`;
    ortPromise = import(/* webpackIgnore: true */ url)
      .then((ort: Ort) => {
        ort.env.wasm.wasmPaths = ORT_DIR;
        // More threads need cross-origin isolation headers the app doesn't set.
        ort.env.wasm.numThreads = 1;
        return ort;
      })
      .catch((err) => {
        ortPromise = null; // allow a retry after a failed download
        throw err;
      });
  }
  return ortPromise;
}

/** The image scaled into the centre of a square, as RGB planes in 0-1. */
function toInputTensor(image: HTMLCanvasElement, ort: Ort) {
  const letterbox = letterboxFor(image.width, image.height, INPUT_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.fillStyle = PAD_COLOR;
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(
    image,
    letterbox.padX,
    letterbox.padY,
    image.width * letterbox.scale,
    image.height * letterbox.scale,
  );

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4] / 255;
    input[plane + i] = data[i * 4 + 1] / 255;
    input[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  const tensor = new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  return { tensor, letterbox };
}

/** A YOLOv8 detection model exported to ONNX, run with ONNX Runtime Web. */
export function createYoloDetector(config: YoloConfig): Detector {
  type Loaded = { ort: Ort; session: InferenceSession; labels: string[] };
  let loaded: Promise<Loaded> | null = null;

  async function loadModel(): Promise<Loaded> {
    const [ort, labels] = await Promise.all([
      loadOrt(),
      fetch(`${config.modelDir}/labels.json`).then((res) => {
        if (!res.ok) throw new Error("Could not load the model's labels");
        return res.json() as Promise<string[]>;
      }),
    ]);
    const session = await ort.InferenceSession.create(
      `${config.modelDir}/model.onnx`,
      { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
    );
    return { ort, session, labels };
  }

  function getModel(): Promise<Loaded> {
    if (!loaded) {
      loaded = loadModel().catch((err) => {
        loaded = null;
        throw err;
      });
    }
    return loaded;
  }

  return {
    name: config.name,
    async load() {
      await getModel();
    },
    async detect(image) {
      const { ort, session, labels } = await getModel();
      const { tensor, letterbox } = toInputTensor(image, ort);
      const results = await session.run({ [session.inputNames[0]]: tensor });
      const output = results[session.outputNames[0]];
      const anchors = output.dims[2];

      const decoded = decodeYoloOutput(
        output.data as Float32Array,
        anchors,
        labels,
        letterbox,
        config.minConfidence,
      ).filter((d) => !config.ignoreLabel?.(d.class));

      return toDetections(
        suppressOverlaps(decoded, IOU_THRESHOLD).map((d) => ({
          ...d,
          class: d.class.toLowerCase(),
        })),
        image.width,
        image.height,
        config.minConfidence,
      );
    },
  };
}
