import { describe, it, expect } from "vitest";
import { generateId, sleep, buildQueryString } from "./utils.js";

describe("generateId", () => {
  it("returns an 8-character string", () => {
    const id = generateId();
    expect(id).toHaveLength(8);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("buildQueryString", () => {
  it("returns empty string when no params defined", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("skips undefined values", () => {
    expect(buildQueryString({ a: "1", b: undefined })).toBe("?a=1");
  });

  it("encodes multiple params", () => {
    const qs = buildQueryString({ name: "hello world", limit: 10 });
    expect(qs).toBe("?name=hello%20world&limit=10");
  });

  it("handles boolean values", () => {
    expect(buildQueryString({ flag: true })).toBe("?flag=true");
  });

  it("returns empty string when all values undefined", () => {
    expect(buildQueryString({ a: undefined, b: undefined })).toBe("");
  });
});
