export type CsvCell = string | number | null;

function escapeCell(cell: CsvCell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  // Stop spreadsheets from running user-typed text (e.g. a label) as a formula.
  const text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n")
    .concat("\r\n");
}

/** A safe file name stem from free text such as a room name. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    // Drop accents rather than the whole letter: "Phòng khách" -> "phong-khach".
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "room";
}
