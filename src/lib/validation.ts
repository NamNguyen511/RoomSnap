import { z } from "zod";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_OBJECTS_PER_SCAN = 200;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password is too long"),
});

export const roomNameSchema = z
  .string()
  .trim()
  .min(1, "Give the room a name")
  .max(60, "Room name is too long");

const fraction = z.number().min(0).max(1);

// Boxes are rounded to 4 decimals on the client, so allow a little slack.
const EDGE_TOLERANCE = 0.001;

export const objectSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    confidence: fraction.nullable(),
    x: fraction,
    y: fraction,
    w: fraction,
    h: fraction,
    source: z.enum(["ai", "manual"]),
  })
  .refine(
    (o) => o.x + o.w <= 1 + EDGE_TOLERANCE && o.y + o.h <= 1 + EDGE_TOLERANCE,
    "Box extends outside the image",
  );

export const objectsSchema = z.array(objectSchema).max(MAX_OBJECTS_PER_SCAN);

export const scanMetaSchema = z.object({
  roomId: z.string().min(1).max(64),
  width: z.coerce.number().int().min(1).max(10000),
  height: z.coerce.number().int().min(1).max(10000),
  modelName: z.string().trim().min(1).max(80),
});
