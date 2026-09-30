"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { deleteUploads } from "@/lib/storage";
import { credentialsSchema, roomNameSchema } from "@/lib/validation";

// `email` is echoed back so the field keeps its value when the form resets.
export type FormState = { error?: string; email?: string } | undefined;

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const typedEmail = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({
    email: typedEmail,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email: typedEmail };
  }
  const { email, password } = parsed.data;

  const taken = { error: "An account with that email already exists", email };
  if (await db.user.findUnique({ where: { email } })) return taken;
  try {
    await db.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12) },
    });
  } catch (err) {
    // Two sign-ups for the same email raced; the unique index caught it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return taken;
    }
    throw err;
  }
  await signIn("credentials", { email, password, redirectTo: "/rooms" });
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: "/rooms",
    });
  } catch (err) {
    if (!(err instanceof AuthError)) throw err; // the success redirect is thrown
    // Other auth errors wrap server faults (e.g. the database being down),
    // which must not be reported as a wrong password.
    return err.type === "CredentialsSignin"
      ? { error: "Wrong email or password", email }
      : { error: "Couldn't log you in right now. Try again shortly.", email };
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function createRoom(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const name = roomNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const room = await db.room.create({ data: { userId, name: name.data } });
  redirect(`/rooms/${room.id}`);
}

export async function renameRoom(
  roomId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const name = roomNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  await db.room.updateMany({
    where: { id: roomId, userId },
    data: { name: name.data },
  });
  revalidatePath(`/rooms/${roomId}`);
}

export async function deleteRoom(roomId: string) {
  const userId = await requireUserId();
  const room = await db.room.findFirst({
    where: { id: roomId, userId },
    include: { scans: { select: { imagePath: true } } },
  });
  if (room) {
    await db.room.delete({ where: { id: room.id } });
    await deleteUploads(room.scans.map((s) => s.imagePath));
  }
  redirect("/rooms");
}

export async function deleteScan(scanId: string) {
  const userId = await requireUserId();
  const scan = await db.scan.findFirst({
    where: { id: scanId, room: { userId } },
  });
  if (!scan) redirect("/rooms");
  await db.scan.delete({ where: { id: scan.id } });
  await deleteUploads([scan.imagePath]);
  redirect(`/rooms/${scan.roomId}`);
}
