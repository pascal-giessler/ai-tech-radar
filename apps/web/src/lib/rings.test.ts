import { describe, expect, it } from "vitest";

import { RINGS, ringMeta, ringRadius } from "./rings";

describe("RINGS", () => {
  it("lists the four rings from inner to outer", () => {
    expect(RINGS.map((r) => r.slug)).toEqual(["adopt", "trial", "assess", "hold"]);
  });
});

describe("ringMeta", () => {
  it("returns label and color for a ring", () => {
    expect(ringMeta("adopt").label).toBe("Adopt");
    expect(ringMeta("hold").color).toMatch(/^#|hsl/);
  });
});

describe("ringRadius", () => {
  it("places Adopt nearest the centre and Hold furthest out", () => {
    expect(ringRadius("adopt")).toBeLessThan(ringRadius("trial"));
    expect(ringRadius("trial")).toBeLessThan(ringRadius("assess"));
    expect(ringRadius("assess")).toBeLessThan(ringRadius("hold"));
  });

  it("keeps all radii within the dial", () => {
    for (const r of RINGS) {
      expect(ringRadius(r.slug)).toBeGreaterThan(0);
      expect(ringRadius(r.slug)).toBeLessThanOrEqual(1);
    }
  });
});
