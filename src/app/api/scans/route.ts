import { randomUUID } from "node:crypto";
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

// Multipart form: roomId, width, height, modelName, objects (JSON), image (file).
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

  const room = await db.room.findFirst({
    where: { id: meta.data.roomId, userId },
    select: { id: true },
  });
  if (!room) return error("Room not found", 404);

  const scanId = randomUUID();
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
    await deleteUploads([imagePath]);
    throw err;
  }

  return Response.json({ id: scanId }, { status: 201 });
}
