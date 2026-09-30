import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteScan } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { LocalTime } from "@/components/LocalTime";
import { SavedScan } from "@/components/SavedScan";
import { db } from "@/lib/db";
import type { Detection } from "@/lib/detector/types";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Scan" };

export default async function SavedScanPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const userId = await requireUserId();
  const { scanId } = await params;
  const scan = await db.scan.findFirst({
    where: { id: scanId, room: { userId } },
    include: {
      room: { select: { id: true, name: true } },
      objects: { orderBy: { id: "asc" } },
    },
  });
  if (!scan) notFound();

  const objects = scan.objects.map(
    ({ label, confidence, x, y, w, h, source }): Detection => ({
      label,
      confidence,
      x,
      y,
      w,
      h,
      source: source === "ai" ? "ai" : "manual",
    }),
  );

  return (
    <>
      <Link
        href={`/rooms/${scan.room.id}`}
        className="text-sm text-muted hover:underline"
      >
        ← {scan.room.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Scan</h1>
        <p className="text-sm text-muted">
          <LocalTime iso={scan.createdAt.toISOString()} />
        </p>
      </div>

      <SavedScan scanId={scan.id} objects={objects} />

      <form action={deleteScan.bind(null, scan.id)}>
        <ConfirmButton
          className="btn btn-danger w-full"
          message="Delete this scan and its photo? This can't be undone."
        >
          Delete scan
        </ConfirmButton>
      </form>
    </>
  );
}
