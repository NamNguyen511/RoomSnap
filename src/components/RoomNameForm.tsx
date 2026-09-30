"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaultValue?: string;
  placeholder?: string;
};

/** Single-field form used to create and to rename a room. */
export function RoomNameForm({
  action,
  submitLabel,
  defaultValue,
  placeholder,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="input min-w-0 flex-1"
          name="name"
          aria-label="Room name"
          placeholder={placeholder}
          defaultValue={defaultValue}
          maxLength={60}
          required
        />
        <button className="btn btn-primary shrink-0" disabled={pending}>
          {submitLabel}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
