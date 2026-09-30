import { signOut } from "@/auth";

// Clears a session whose account no longer exists (see requireUserId).
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
