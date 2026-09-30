export const MAX_IMAGE_EDGE = 1600;
/**
 * Every image is shrunk to this before a model sees it. The models work at
 * 640 px or less anyway, and using one size for live frames and saved photos
 * keeps their results the same.
 */
export const DETECTION_MAX_EDGE = 640;

/** Scales a size down (never up) so its longest edge is at most `maxEdge`. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Decodes a photo into a canvas, applying its EXIF rotation and downscaling
 * it so detection and upload stay fast on a phone.
 */
export async function fileToCanvas(
  file: Blob,
  maxEdge = MAX_IMAGE_EDGE,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/** A copy of the image at the size the detection models are given. */
export function toDetectionCanvas(
  source: HTMLCanvasElement | HTMLVideoElement,
  into: HTMLCanvasElement = document.createElement("canvas"),
): HTMLCanvasElement {
  const sourceWidth = "videoWidth" in source ? source.videoWidth : source.width;
  const sourceHeight = "videoHeight" in source ? source.videoHeight : source.height;
  const { width, height } = fitWithin(sourceWidth, sourceHeight, DETECTION_MAX_EDGE);
  if (into.width !== width) into.width = width;
  if (into.height !== height) into.height = height;
  const ctx = into.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.drawImage(source, 0, 0, width, height);
  return into;
}

export function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the photo")),
      "image/jpeg",
      quality,
    );
  });
}
