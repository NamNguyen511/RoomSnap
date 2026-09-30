import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/app/actions";
import { CredentialsForm } from "@/components/CredentialsForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Log in</h1>
      <CredentialsForm
        action={login}
        submitLabel="Log in"
        passwordAutoComplete="current-password"
      />
      <p className="text-sm text-muted">
        New here?{" "}
        <Link className="font-medium text-accent underline" href="/register">
          Create an account
        </Link>
      </p>
    </>
  );
}
