import { describe, expect, it } from "vitest";
import { toDetections } from "./normalize";

describe("toDetections", () => {
  it("converts pixel boxes to fractions of the image", () => {
    const [chair] = toDetections(
      [{ bbox: [100, 50, 200, 300], class: "chair", score: 0.9 }],
      1000,
      500,
      0.5,
    );
    expect(chair).toEqual({
      label: "chair",
      confidence: 0.9,
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.6,
      source: "ai",
    });
  });

  it("drops results below the confidence threshold", () => {
    const result = toDetections(
      [
        { bbox: [0, 0, 10, 10], class: "vase", score: 0.49 },
        { bbox: [0, 0, 10, 10], class: "book", score: 0.5 },
      ],
      100,
      100,
      0.5,
    );
    expect(result.map((d) => d.label)).toEqual(["book"]);
  });

  it("clips boxes that spill outside the image", () => {
    const [couch] = toDetections(
      [{ bbox: [-20, 80, 70, 40], class: "couch", score: 0.8 }],
      100,
      100,
      0.5,
    );
    expect(couch).toMatchObject({ x: 0, y: 0.8, w: 0.5, h: 0.2 });
  });

  it("drops boxes that lie entirely outside the image", () => {
    const result = toDetections(
      [{ bbox: [120, 10, 30, 30], class: "tv", score: 0.9 }],
      100,
      100,
      0.5,
    );
    expect(result).toEqual([]);
  });

  it("orders results from most to least confident", () => {
    const result = toDetections(
      [
        { bbox: [0, 0, 10, 10], class: "clock", score: 0.6 },
        { bbox: [0, 0, 10, 10], class: "bed", score: 0.95 },
      ],
      100,
      100,
      0.5,
    );
    expect(result.map((d) => d.label)).toEqual(["bed", "clock"]);
  });
});
