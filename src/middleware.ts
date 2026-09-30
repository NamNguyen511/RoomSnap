import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Redirects signed-out visitors to /login (see `authorized` in auth.config.ts).
export default NextAuth(authConfig).auth;

export const config = {
  // API routes check the session themselves; static and PWA assets are public.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|swe-worker|icons/|models/|ort/|~offline).*)",
  ],
};
