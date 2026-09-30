"use client";

import { useState } from "react";
import type { PdfScan } from "@/lib/pdf";

type Props = { roomName: string; fileName: string; scans: PdfScan[] };

export function ExportPdfButton({ roomName, fileName, scans }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand: the PDF library is only needed for exports.
      const { downloadRoomPdf } = await import("@/lib/pdf");
      await downloadRoomPdf(roomName, scans, fileName);
    } catch {
      setError("Couldn't build the PDF. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={exportPdf}>
        {busy ? "Building PDF…" : "Export PDF"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
