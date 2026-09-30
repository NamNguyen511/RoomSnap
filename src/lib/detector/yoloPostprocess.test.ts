import { describe, expect, it } from "vitest";
import {
  decodeYoloOutput,
  letterboxFor,
  suppressOverlaps,
} from "./yoloPostprocess";

describe("letterboxFor", () => {
  it("pads the short side of a landscape image equally top and bottom", () => {
    expect(letterboxFor(1280, 640, 640)).toEqual({
      scale: 0.5,
      padX: 0,
      padY: 160,
    });
  });

  it("pads a portrait image left and right", () => {
    expect(letterboxFor(320, 640, 640)).toEqual({ scale: 1, padX: 160, padY: 0 });
  });
});

describe("decodeYoloOutput", () => {
  const labels = ["Chair", "Lamp"];
  // Two anchors, rows: cx, cy, w, h, score(Chair), score(Lamp).
  const output = new Float32Array([
    320, 100, // cx
    320, 100, // cy
    200, 50, // w
    100, 50, // h
    0.1, 0.05, // Chair
    0.7, 0.02, // Lamp
  ]);

  it("maps boxes back to original-image pixels and picks the best class", () => {
    const letterbox = letterboxFor(1280, 640, 640);
    const result = decodeYoloOutput(output, 2, labels, letterbox, 0.25);
    expect(result).toHaveLength(1);
    expect(result[0].class).toBe("Lamp");
    expect(result[0].score).toBeCloseTo(0.7);
    // Centre (320, 320 - 160 pad) / 0.5 = (640, 320); size (400, 200).
    expect(result[0].bbox).toEqual([440, 220, 400, 200]);
  });

  it("drops anchors whose best score is under the threshold", () => {
    const letterbox = letterboxFor(640, 640, 640);
    expect(decodeYoloOutput(output, 2, labels, letterbox, 0.8)).toEqual([]);
  });
});

describe("suppressOverlaps", () => {
  const box = (x: number, score: number, label = "Chair") => ({
    bbox: [x, 0, 100, 100] as [number, number, number, number],
    class: label,
    score,
  });

  it("keeps only the most confident of heavily overlapping boxes", () => {
    const result = suppressOverlaps([box(0, 0.4), box(5, 0.9), box(10, 0.6)], 0.6);
    expect(result.map((d) => d.score)).toEqual([0.9]);
  });

  it("treats differently labelled boxes on the same object as one", () => {
    const result = suppressOverlaps(
      [box(0, 0.5, "Table"), box(2, 0.3, "Coffee table")],
      0.6,
    );
    expect(result.map((d) => d.class)).toEqual(["Table"]);
  });

  it("keeps boxes that barely overlap", () => {
    expect(suppressOverlaps([box(0, 0.9), box(90, 0.8)], 0.6)).toHaveLength(2);
  });
});
