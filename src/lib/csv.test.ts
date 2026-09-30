import { describe, expect, it } from "vitest";
import { slugify, toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows with CRLF line endings", () => {
    expect(toCsv(["label", "confidence"], [["chair", 0.9]])).toBe(
      "label,confidence\r\nchair,0.9\r\n",
    );
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    expect(toCsv(["a"], [['big, "old" chair'], ["two\nlines"]])).toBe(
      'a\r\n"big, ""old"" chair"\r\n"two\nlines"\r\n',
    );
  });

  it("writes null as an empty cell", () => {
    expect(toCsv(["label", "confidence"], [["lamp", null]])).toBe(
      "label,confidence\r\nlamp,\r\n",
    );
  });

  it("neutralises text a spreadsheet would run as a formula", () => {
    expect(toCsv(["label"], [["=SUM(A1:A9)"], ["-cmd"]])).toBe(
      "label\r\n'=SUM(A1:A9)\r\n'-cmd\r\n",
    );
  });

  it("leaves negative numbers alone", () => {
    expect(toCsv(["n"], [[-1.5]])).toBe("n\r\n-1.5\r\n");
  });
});

describe("slugify", () => {
  it("makes a file-name-safe slug", () => {
    expect(slugify("Living Room #2")).toBe("living-room-2");
  });

  it("keeps accented letters as their base letter", () => {
    expect(slugify("Phòng khách")).toBe("phong-khach");
    expect(slugify("Phòng Đọc")).toBe("phong-doc");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("客厅")).toBe("room");
  });
});
