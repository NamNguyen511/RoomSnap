import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { readUpload } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const scan = await db.scan.findFirst({
    where: { id, room: { userId } },
    select: { imagePath: true },
  });
  if (!scan) return new Response("Not found", { status: 404 });

  const { bytes, contentType } = await readUpload(scan.imagePath).catch(() => ({
    bytes: null,
    contentType: "",
  }));
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      // A scan's photo never changes, but it is private to its owner.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
