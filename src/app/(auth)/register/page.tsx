import type { Metadata } from "next";
import Link from "next/link";
import { register } from "@/app/actions";
import { CredentialsForm } from "@/components/CredentialsForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create an account</h1>
      <CredentialsForm
        action={register}
        submitLabel="Create account"
        passwordAutoComplete="new-password"
        passwordHint="At least 8 characters."
      />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-accent underline" href="/login">
          Log in
        </Link>
      </p>
    </>
  );
}
