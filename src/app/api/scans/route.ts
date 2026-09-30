import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { deleteUploads, saveUpload, sniffImageType } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  objectsSchema,
  scanMetaSchema,
} from "@/lib/validation";

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });

/** "own" if the scan exists and belongs to this user; "taken" if someone else's. */
async function existingScan(id: string, userId: string) {
  const scan = await db.scan.findUnique({
    where: { id },
    select: { room: { select: { userId: true } } },
  });
  if (!scan) return null;
  return scan.room.userId === userId ? "own" : "taken";
}

// Multipart form: roomId, width, height, modelName, objects (JSON), image
// (file), and optionally id (a UUID chosen by the client).
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return error("Log in to save scans", 401);

  // Reject obviously oversized requests before reading the body.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return error("Photo is too large (8 MB maximum)", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Expected a multipart form", 400);
  }

  const meta = scanMetaSchema.safeParse({
    id: form.get("id") ?? undefined,
    roomId: form.get("roomId"),
    width: form.get("width"),
    height: form.get("height"),
    modelName: form.get("modelName"),
  });
  if (!meta.success) return error("Invalid scan details", 400);

  let objectsJson: unknown;
  try {
    objectsJson = JSON.parse(String(form.get("objects") ?? "[]"));
  } catch {
    return error("Invalid object list", 400);
  }
  const objects = objectsSchema.safeParse(objectsJson);
  if (!objects.success) return error("Invalid object list", 400);

  const image = form.get("image");
  if (!(image instanceof File)) return error("Photo is missing", 400);
  if (image.size > MAX_UPLOAD_BYTES) {
    return error("Photo is too large (8 MB maximum)", 413);
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) return error("Photo must be a JPEG, PNG or WebP image", 415);

  // A retry of an upload that already succeeded (the reply was lost): report
  // success again rather than storing the scan twice.
  if (meta.data.id) {
    const existing = await existingScan(meta.data.id, userId);
    if (existing === "own") return Response.json({ id: meta.data.id });
    if (existing === "taken") return error("Scan id is already in use", 409);
  }

  const room = await db.room.findFirst({
    where: { id: meta.data.roomId, userId },
    select: { id: true },
  });
  if (!room) return error("The room this scan belongs to no longer exists", 404);

  const scanId = meta.data.id ?? randomUUID();
  const imagePath = await saveUpload(userId, scanId, ext, bytes);
  try {
    await db.scan.create({
      data: {
        id: scanId,
        roomId: room.id,
        imagePath,
        width: meta.data.width,
        height: meta.data.height,
        modelName: meta.data.modelName,
        objects: { create: objects.data },
      },
    });
  } catch (err) {
    // Two uploads of the same scan raced and the other one won. Its photo is
    // at the same path, so it must not be deleted.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      (await existingScan(scanId, userId)) === "own"
    ) {
      return Response.json({ id: scanId });
    }
    await deleteUploads([imagePath]);
    throw err;
  }

  return Response.json({ id: scanId }, { status: 201 });
}
