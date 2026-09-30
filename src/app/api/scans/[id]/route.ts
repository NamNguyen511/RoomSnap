import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { objectsSchema } from "@/lib/validation";

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });

// Replaces the scan's object list. Body: { objects: [...] }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return error("Log in to edit scans", 401);

  const body = await request.json().catch(() => null);
  const objects = objectsSchema.safeParse(body?.objects);
  if (!objects.success) return error("Invalid object list", 400);

  const { id } = await params;
  const scan = await db.scan.findFirst({
    where: { id, room: { userId } },
    select: { id: true },
  });
  if (!scan) return error("Scan not found", 404);

  await db.$transaction([
    db.detectedObject.deleteMany({ where: { scanId: scan.id } }),
    db.detectedObject.createMany({
      data: objects.data.map((o) => ({ ...o, scanId: scan.id })),
    }),
  ]);

  return Response.json({ ok: true });
}
