import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRoom, renameRoom } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExportPdfButton } from "@/components/ExportPdfButton";
import { LocalTime } from "@/components/LocalTime";
import { RoomNameForm } from "@/components/RoomNameForm";
import { slugify } from "@/lib/csv";
import { db } from "@/lib/db";
import type { Detection } from "@/lib/detector/types";
import { countByLabel } from "@/lib/labels";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const userId = await requireUserId();
  const { roomId } = await params;
  const room = await db.room.findFirst({
    where: { id: roomId, userId },
    include: {
      scans: { orderBy: { createdAt: "desc" }, include: { objects: true } },
    },
  });
  if (!room) notFound();

  const pdfScans = room.scans.map((scan) => ({
    id: scan.id,
    createdAt: scan.createdAt.toISOString(),
    objects: scan.objects.map(
      ({ label, confidence, x, y, w, h, source }): Detection => ({
        label,
        confidence,
        x,
        y,
        w,
        h,
        source: source === "ai" ? "ai" : "manual",
      }),
    ),
  }));

  return (
    <>
      <Link href="/rooms" className="text-sm text-muted hover:underline">
        ← All rooms
      </Link>
      <h1 className="text-2xl font-semibold">{room.name}</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/rooms/${room.id}/scan`}
          className="btn btn-primary basis-full sm:basis-auto"
        >
          New scan
        </Link>
        {room.scans.length > 0 && (
          <>
            <a
              href={`/api/rooms/${room.id}/export.csv`}
              download
              className="btn"
            >
              Export CSV
            </a>
            <ExportPdfButton
              roomName={room.name}
              fileName={`${slugify(room.name)}-inventory.pdf`}
              scans={pdfScans}
            />
          </>
        )}
      </div>

      {room.scans.length === 0 ? (
        <p className="text-muted">
          No scans yet. Take a photo of this room to list what&apos;s in it.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {room.scans.map((scan) => (
            <li key={scan.id}>
              <Link
                href={`/scans/${scan.id}`}
                className="card flex gap-3 p-3 transition-colors hover:border-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected source */}
                <img
                  src={`/api/scans/${scan.id}/image`}
                  alt=""
                  loading="lazy"
                  className="size-20 shrink-0 rounded-lg object-cover"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="font-medium">
                    <LocalTime iso={scan.createdAt.toISOString()} />
                  </p>
                  <p className="text-sm text-muted">
                    {scan.objects.length}{" "}
                    {scan.objects.length === 1 ? "object" : "objects"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {countByLabel(scan.objects)
                      .slice(0, 6)
                      .map(({ label, count }) => (
                        <span key={label} className="chip">
                          {label} × {count}
                        </span>
                      ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Room settings
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <RoomNameForm
            action={renameRoom.bind(null, room.id)}
            submitLabel="Rename"
            defaultValue={room.name}
          />
          <form action={deleteRoom.bind(null, room.id)}>
            <ConfirmButton
              className="btn btn-danger"
              message={`Delete "${room.name}" and all of its scans? This can't be undone.`}
            >
              Delete room
            </ConfirmButton>
          </form>
        </div>
      </details>
    </>
  );
}
