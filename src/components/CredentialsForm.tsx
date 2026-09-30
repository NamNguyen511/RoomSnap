"use client";

import { useActionState, useEffect } from "react";
import type { FormState } from "@/app/actions";
import { clearPrivateCaches } from "@/lib/caches";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  passwordHint?: string;
};

export function CredentialsForm({
  action,
  submitLabel,
  passwordAutoComplete,
  passwordHint,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  // Anyone seeing this form is signed out, however the session ended (Log out,
  // expiry, deleted account), so nothing cached for the last account may remain.
  useEffect(() => {
    clearPrivateCaches().catch(() => {});
  }, []);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={state?.email}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          className="input"
          type="password"
          name="password"
          autoComplete={passwordAutoComplete}
          minLength={passwordAutoComplete === "new-password" ? 8 : undefined}
          required
        />
        {passwordHint && (
          <span className="font-normal text-muted">{passwordHint}</span>
        )}
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
