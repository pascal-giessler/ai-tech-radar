import { describe, expect, it } from "vitest";

import { bubbleRadius, logStars, starDomain, xFrac, yFrac } from "./quadrant";

describe("quadrant geometry", () => {
  it("log-scales stars", () => {
    expect(logStars(1000)).toBeCloseTo(3);
    expect(logStars(0)).toBe(0); // clamped to 1
  });

  it("orders x by maturity within the domain", () => {
    const d = starDomain([50, 500, 5000, 50000]);
    expect(xFrac(50, d)).toBeLessThan(xFrac(50000, d));
    expect(xFrac(50, d)).toBeGreaterThanOrEqual(0);
    expect(xFrac(50000, d)).toBeLessThanOrEqual(1);
  });

  it("clamps momentum to 0..1", () => {
    expect(yFrac(-10)).toBe(0);
    expect(yFrac(150)).toBe(1);
    expect(yFrac(50)).toBeCloseTo(0.5);
  });

  it("sizes bubbles by sqrt of gain (area-proportional)", () => {
    const small = bubbleRadius(25, 100);
    const big = bubbleRadius(100, 100);
    expect(big).toBeGreaterThan(small);
    expect(bubbleRadius(0, 100)).toBe(3); // min radius floor
  });
});
