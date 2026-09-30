import { type CsvCell, slugify, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

const HEADER = [
  "room",
  "scan_id",
  "scan_date",
  "label",
  "confidence",
  "source",
  "x",
  "y",
  "width",
  "height",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const room = await db.room.findFirst({
    where: { id, userId },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        include: { objects: { orderBy: { label: "asc" } } },
      },
    },
  });
  if (!room) return new Response("Not found", { status: 404 });

  const rows: CsvCell[][] = room.scans.flatMap((scan) =>
    scan.objects.map((o) => [
      room.name,
      scan.id,
      scan.createdAt.toISOString(),
      o.label,
      o.confidence,
      o.source,
      o.x,
      o.y,
      o.w,
      o.h,
    ]),
  );

  return new Response(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(room.name)}-inventory.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
