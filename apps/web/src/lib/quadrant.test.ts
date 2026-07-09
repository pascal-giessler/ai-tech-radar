import { describe, expect, it } from "vitest";

import { bubbleRadius, jitter, logStars, starDomain, xFrac, yFrac } from "./quadrant";

describe("quadrant geometry", () => {
  it("log-scales stars", () => {
    expect(logStars(1000)).toBeCloseTo(3);
    expect(logStars(0)).toBe(0); // clamped to 1
  });

  it("orders x by maturity, kept inside the inset frame", () => {
    const d = starDomain([50, 500, 5000, 50000]);
    expect(xFrac(50, d)).toBeLessThan(xFrac(50000, d));
    // never on the frame edge (would clip a centre-anchored dot)
    expect(xFrac(50, d)).toBeGreaterThan(0);
    expect(xFrac(50000, d)).toBeLessThan(1);
  });

  it("maps momentum into an inset band so max/min never clip the frame", () => {
    expect(yFrac(-10)).toBeGreaterThan(0); // floor above the frame
    expect(yFrac(150)).toBeLessThan(1); // headroom below the top
    expect(yFrac(0)).toBeLessThan(yFrac(50));
    expect(yFrac(50)).toBeLessThan(yFrac(100));
  });

  it("jitters deterministically within bounds", () => {
    expect(jitter("acme-rtk", 0.02)).toBe(jitter("acme-rtk", 0.02)); // stable
    expect(Math.abs(jitter("acme-rtk", 0.02))).toBeLessThanOrEqual(0.02);
    expect(jitter("a", 0.02)).not.toBe(jitter("b", 0.02)); // varies by slug
  });

  it("sizes bubbles by sqrt of gain (area-proportional)", () => {
    const small = bubbleRadius(25, 100);
    const big = bubbleRadius(100, 100);
    expect(big).toBeGreaterThan(small);
    expect(bubbleRadius(0, 100)).toBe(3); // min radius floor
  });
});
