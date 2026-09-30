export type DetectionSource = "ai" | "manual";

/** One object in a photo. The box is in fractions (0-1) of the image size. */
export type Detection = {
  label: string;
  /** Model confidence 0-1, or null for objects added or relabelled by hand. */
  confidence: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  source: DetectionSource;
};

/** Where a model runs: the graphics chip is much faster than the processor. */
export type DetectorBackend = "gpu" | "cpu";

/** An object-detection model. Swap implementations without touching the UI. */
export interface Detector {
  /** Stored with each scan so results can be traced to a model. */
  readonly name: string;
  /** Known once the model has loaded; null before that. */
  readonly backend: DetectorBackend | null;
  /** Downloads and initialises the model. Safe to call more than once. */
  load(): Promise<void>;
  detect(image: HTMLCanvasElement): Promise<Detection[]>;
}
