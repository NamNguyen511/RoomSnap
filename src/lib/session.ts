import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** For API routes: the signed-in user's id, or null. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  return user?.id ?? null;
}

/** For pages and server actions: the signed-in user's id, or a redirect. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  // The cookie is valid but the account is gone (e.g. database reset):
  // clear the session, otherwise the middleware would bounce /login back here.
  if (!user) redirect("/signout");
  return user.id;
}
