import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Scanner } from "@/components/Scanner";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "New scan" };

export default async function ScanPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const userId = await requireUserId();
  const { roomId } = await params;
  const room = await db.room.findFirst({ where: { id: roomId, userId } });
  if (!room) notFound();

  return (
    <>
      <Link
        href={`/rooms/${room.id}`}
        className="text-sm text-muted hover:underline"
      >
        ← {room.name}
      </Link>
      <h1 className="text-2xl font-semibold">New scan</h1>
      <Scanner roomId={room.id} />
    </>
  );
}
