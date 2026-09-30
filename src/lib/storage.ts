import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "data/uploads");

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Identify an image by its leading bytes; returns a file extension or null. */
export function sniffImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

function resolveUpload(relativePath: string): string {
  const full = path.resolve(UPLOAD_ROOT, relativePath);
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error("Upload path escapes the upload directory");
  }
  return full;
}

/** Stores the photo and returns its path relative to the upload directory. */
export async function saveUpload(
  userId: string,
  scanId: string,
  ext: string,
  bytes: Uint8Array,
): Promise<string> {
  const relativePath = path.join(userId, `${scanId}.${ext}`);
  const full = resolveUpload(relativePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return relativePath;
}

export async function readUpload(
  relativePath: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const bytes = await readFile(resolveUpload(relativePath));
  const ext = path.extname(relativePath).slice(1);
  return { bytes, contentType: MIME_BY_EXT[ext] ?? "application/octet-stream" };
}

export async function deleteUploads(relativePaths: string[]): Promise<void> {
  await Promise.all(
    relativePaths.map((p) => rm(resolveUpload(p), { force: true })),
  );
}
