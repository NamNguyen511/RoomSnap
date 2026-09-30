import { describe, expect, it } from "vitest";
import { isTransient, newScanId } from "./pendingScans";

describe("newScanId", () => {
  it("produces distinct version-4 UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = newScanId();
    const b = newScanId();
    expect(a).toMatch(uuid);
    expect(b).toMatch(uuid);
    expect(a).not.toBe(b);
  });
});

describe("isTransient", () => {
  it("retries later when logged out, throttled or the server is failing", () => {
    for (const status of [401, 408, 429, 500, 502, 503]) {
      expect(isTransient(status), String(status)).toBe(true);
    }
  });

  it("does not retry what the server will keep refusing", () => {
    for (const status of [400, 404, 409, 413, 415]) {
      expect(isTransient(status), String(status)).toBe(false);
    }
  });
});
