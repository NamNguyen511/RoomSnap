import type { Metadata } from "next";
import Link from "next/link";
import { createRoom } from "@/app/actions";
import { RoomNameForm } from "@/components/RoomNameForm";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage() {
  const userId = await requireUserId();
  const rooms = await db.room.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { scans: true } },
      scans: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Your rooms</h1>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted">Add a room</h2>
        <RoomNameForm
          action={createRoom}
          submitLabel="Add"
          placeholder="e.g. Living room"
        />
      </section>

      {rooms.length === 0 ? (
        <p className="text-muted">
          No rooms yet. Add one above, then take a photo of it to see what
          RoomSnap finds.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => {
            const latest = room.scans[0];
            return (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="card flex items-center gap-3 p-3 transition-colors hover:border-muted"
                >
                  {latest ? (
                    // eslint-disable-next-line @next/next/no-img-element -- auth-protected source
                    <img
                      src={`/api/scans/${latest.id}/image`}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-lg bg-accent-soft" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{room.name}</p>
                    <p className="text-sm text-muted">
                      {room._count.scans}{" "}
                      {room._count.scans === 1 ? "scan" : "scans"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
