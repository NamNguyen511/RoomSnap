"use client";

type Props = {
  message: string;
  className?: string;
  children: React.ReactNode;
};

/** A submit button that asks for confirmation before its form is sent. */
export function ConfirmButton({ message, className, children }: Props) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
