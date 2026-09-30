"use client";

import { forgetScanPhotos } from "@/lib/caches";

type Props = {
  message: string;
  className?: string;
  /** Scans the form deletes, so their cached photos go with them. */
  deletesScanIds?: string[];
  children: React.ReactNode;
};

/** A submit button that asks for confirmation before its form is sent. */
export function ConfirmButton({
  message,
  className,
  deletesScanIds = [],
  children,
}: Props) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        forgetScanPhotos(deletesScanIds).catch(() => {});
      }}
    >
      {children}
    </button>
  );
}
