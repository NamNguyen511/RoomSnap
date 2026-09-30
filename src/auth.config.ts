import type { NextAuthConfig } from "next-auth";

const AUTH_PAGES = ["/login", "/register"];

// Edge-safe part of the auth setup (no database access), shared by the
// middleware and the full config in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      if (AUTH_PAGES.includes(nextUrl.pathname)) {
        if (loggedIn) return Response.redirect(new URL("/rooms", nextUrl));
        return true;
      }
      return loggedIn;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
