import type { InferenceSession } from "onnxruntime-web";
import { toDetections } from "./normalize";
import type { Detector, DetectorBackend } from "./types";
import {
  decodeYoloOutput,
  letterboxFor,
  suppressOverlaps,
} from "./yoloPostprocess";

type Ort = typeof import("onnxruntime-web");
type Runtime = { ort: Ort; webgpu: boolean };

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

type GpuAdapter = {
  isFallbackAdapter?: boolean;
  info?: { isFallbackAdapter?: boolean };
};

async function canUseWebGpu(): Promise<boolean> {
  // Typed by hand: the built-in WebGPU types lag behind what browsers ship.
  const gpu = (
    navigator as unknown as {
      gpu?: { requestAdapter(): Promise<GpuAdapter | null> };
    }
  ).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;
    // A fallback adapter emulates the graphics chip in software, which is
    // slower than running on the processor directly.
    return !(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter);
  } catch {
    return false;
  }
}

let runtimePromise: Promise<Runtime> | null = null;

/**
 * Loads ONNX Runtime. Devices with WebGPU get the build that can run models
 * on the graphics chip; the rest get the CPU-only build, which is half the
 * download.
 */
function loadRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const webgpu = await canUseWebGpu();
      const url = `${ORT_DIR}${webgpu ? "ort.webgpu.min.mjs" : "ort.wasm.min.mjs"}`;
      const ort: Ort = await import(/* webpackIgnore: true */ url);
      ort.env.wasm.wasmPaths = ORT_DIR;
      // More threads need cross-origin isolation headers the app doesn't set.
      ort.env.wasm.numThreads = 1;
      return { ort, webgpu };
    })().catch((err) => {
      runtimePromise = null; // allow a retry after a failed download
      throw err;
    });
  }
  return runtimePromise;
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
  type Loaded = {
    ort: Ort;
    session: InferenceSession;
    labels: string[];
    backend: DetectorBackend;
  };
  let loaded: Promise<Loaded> | null = null;
  let backend: DetectorBackend | null = null;
  // A session runs one image at a time; a capture can arrive while a live
  // frame is still being processed, so runs are queued.
  let queue: Promise<unknown> = Promise.resolve();

  const modelUrl = `${config.modelDir}/model.onnx`;

  function createSession(ort: Ort, providers: string[]) {
    return ort.InferenceSession.create(modelUrl, {
      executionProviders: providers,
      graphOptimizationLevel: "all",
    });
  }

  async function loadModel(): Promise<Loaded> {
    const [{ ort, webgpu }, labels] = await Promise.all([
      loadRuntime(),
      fetch(`${config.modelDir}/labels.json`).then((res) => {
        if (!res.ok) throw new Error("Could not load the model's labels");
        return res.json() as Promise<string[]>;
      }),
    ]);
    if (webgpu) {
      try {
        const session = await createSession(ort, ["webgpu"]);
        return { ort, session, labels, backend: "gpu" };
      } catch {
        // WebGPU is present but can't run this model; use the processor.
      }
    }
    const session = await createSession(ort, ["wasm"]);
    return { ort, session, labels, backend: "cpu" };
  }

  function getModel(): Promise<Loaded> {
    if (!loaded) {
      loaded = loadModel().then(
        (model) => {
          backend = model.backend;
          return model;
        },
        (err) => {
          loaded = null;
          throw err;
        },
      );
    }
    return loaded;
  }

  async function run(image: HTMLCanvasElement) {
    let model = await getModel();
    const { tensor, letterbox } = toInputTensor(image, model.ort);
    const infer = (session: InferenceSession) =>
      session.run({ [session.inputNames[0]]: tensor });

    let results: Awaited<ReturnType<typeof infer>>;
    try {
      results = await infer(model.session);
    } catch (err) {
      if (model.backend !== "gpu") throw err;
      // Some graphics drivers fail at run time rather than at load; switch
      // this model to the processor for good and try again.
      const session = await createSession(model.ort, ["wasm"]);
      model = { ...model, session, backend: "cpu" };
      loaded = Promise.resolve(model);
      backend = "cpu";
      results = await infer(session);
    }

    const output = results[model.session.outputNames[0]];
    const decoded = decodeYoloOutput(
      output.data as Float32Array,
      output.dims[2],
      model.labels,
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
  }

  return {
    name: config.name,
    get backend() {
      return backend;
    },
    async load() {
      await getModel();
    },
    detect(image) {
      const result = queue.then(() => run(image));
      queue = result.catch(() => {});
      return result;
    },
  };
}
