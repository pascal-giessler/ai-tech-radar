import { describe, expect, it } from "vitest";

import { clusterHue, formatStars, scoreTier } from "./format";

describe("formatStars", () => {
  it("keeps small counts as-is", () => {
    expect(formatStars(999)).toBe("999");
  });
  it("abbreviates thousands with one decimal", () => {
    expect(formatStars(1234)).toBe("1.2k");
    expect(formatStars(45600)).toBe("45.6k");
  });
  it("abbreviates millions", () => {
    expect(formatStars(2_300_000)).toBe("2.3m");
  });
});

describe("scoreTier", () => {
  it("maps momentum score to named tiers", () => {
    expect(scoreTier(90)).toBe("blazing");
    expect(scoreTier(55)).toBe("rising");
    expect(scoreTier(25)).toBe("steady");
    expect(scoreTier(5)).toBe("quiet");
  });
});

describe("clusterHue", () => {
  it("is deterministic per cluster id", () => {
    expect(clusterHue(3)).toBe(clusterHue(3));
  });
  it("spreads neighbouring ids far apart on the wheel", () => {
    const gap = Math.abs(clusterHue(1) - clusterHue(2));
    expect(Math.min(gap, 360 - gap)).toBeGreaterThan(60);
  });
  it("stays within [0, 360)", () => {
    for (let i = 0; i < 20; i++) {
      expect(clusterHue(i)).toBeGreaterThanOrEqual(0);
      expect(clusterHue(i)).toBeLessThan(360);
    }
  });
});
