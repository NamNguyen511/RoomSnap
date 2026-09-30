import type { Detection } from "@/lib/detector/types";
import { fitWithin } from "@/lib/image";
import { colorForLabel } from "@/lib/labels";

export type PdfScan = { id: string; createdAt: string; objects: Detection[] };

const FONT = "NotoSans";
const FONT_URL = "/fonts/NotoSans-Regular.ttf";
const MARGIN = 40;
const MAX_IMAGE_HEIGHT = 330;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** The scan photo with its boxes drawn on, as a JPEG data URL. */
async function renderScanPhoto(scan: PdfScan) {
  const res = await fetch(`/api/scans/${scan.id}/image`);
  if (!res.ok) throw new Error("Could not load a scan photo");
  const bitmap = await createImageBitmap(await res.blob());
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 1200);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const fontSize = Math.max(12, Math.round(width / 60));
  ctx.lineWidth = Math.max(2, Math.round(width / 300));
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  for (const o of scan.objects) {
    const color = colorForLabel(o.label);
    const x = o.x * width;
    const y = o.y * height;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, o.w * width, o.h * height);
    const textWidth = ctx.measureText(o.label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, textWidth + 8, fontSize + 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(o.label, x + 4, y + 3);
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.8), width, height };
}

function summarise(objects: Detection[]): string[][] {
  const byLabel = new Map<string, { ai: number; manual: number }>();
  for (const o of objects) {
    const entry = byLabel.get(o.label) ?? { ai: 0, manual: 0 };
    entry[o.source] += 1;
    byLabel.set(o.label, entry);
  }
  return [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, n]) => [
      label,
      String(n.ai + n.manual),
      String(n.ai),
      String(n.manual),
    ]);
}

/** Builds the room inventory PDF and starts the download. */
export async function downloadRoomPdf(
  roomName: string,
  scans: PdfScan[],
  fileName: string,
): Promise<void> {
  const [{ jsPDF }, { autoTable }, fontRes] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    fetch(FONT_URL),
  ]);
  if (!fontRes.ok) throw new Error("Could not load the PDF font");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // The built-in PDF fonts only cover Latin-1; embed one that handles
  // accented room names and labels (e.g. Vietnamese).
  doc.addFileToVFS("NotoSans-Regular.ttf", toBase64(await fontRes.arrayBuffer()));
  doc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  doc.setFont(FONT, "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  doc.setFontSize(20);
  doc.text(`${roomName}: room inventory`, MARGIN, 56, { maxWidth: contentWidth });
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Exported ${new Date().toLocaleString()} · ${scans.length} ${scans.length === 1 ? "scan" : "scans"}`,
    MARGIN,
    76,
  );
  doc.setTextColor(0);

  let y = 104;
  for (const scan of scans) {
    const photo = await renderScanPhoto(scan);
    const scale = Math.min(
      contentWidth / photo.width,
      MAX_IMAGE_HEIGHT / photo.height,
    );
    const w = photo.width * scale;
    const h = photo.height * scale;

    if (y + 24 + h > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN + 12;
    }

    doc.setFontSize(13);
    doc.text(`Scan from ${new Date(scan.createdAt).toLocaleString()}`, MARGIN, y);
    y += 12;
    doc.addImage(photo.dataUrl, "JPEG", MARGIN, y, w, h);
    y += h + 12;

    if (scan.objects.length === 0) {
      doc.setFontSize(10);
      doc.text("No objects recorded.", MARGIN, y + 8);
      y += 36;
      continue;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Object", "Quantity", "Found by AI", "Added by hand"]],
      body: summarise(scan.objects),
      styles: { font: FONT, fontStyle: "normal", fontSize: 10 },
      headStyles: { font: FONT, fontStyle: "normal", fillColor: [15, 118, 110] },
    });
    const table = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable;
    y = table.finalY + 32;
  }

  doc.save(fileName);
}
