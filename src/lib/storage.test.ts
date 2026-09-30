import { describe, expect, it } from "vitest";
import { sniffImageType } from "./storage";

const bytes = (head: number[] | string) => {
  const out = new Uint8Array(16);
  out.set(typeof head === "string" ? [...head].map((c) => c.charCodeAt(0)) : head);
  return out;
};

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their leading bytes", () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(sniffImageType(bytes("RIFF\0\0\0\0WEBP"))).toBe("webp");
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffImageType(bytes("<svg xmlns="))).toBeNull();
    expect(sniffImageType(bytes("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array(4))).toBeNull();
  });
});
