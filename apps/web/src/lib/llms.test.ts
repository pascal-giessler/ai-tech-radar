import { describe, expect, it } from "vitest";

import { buildLlmsTxt } from "./llms";
import type { LandscapeData } from "./types";

const data: LandscapeData = {
  generated_at: "2026-07-07T12:00:00+00:00",
  clusters: [
    {
      id: 1,
      label: "Token Usage",
      slug: "token-usage",
      size: 2,
      centroid: { x: 0, y: 0, z: 0 },
      keywords: ["token", "proxy"],
      description: "2 tools grouped by semantic similarity.",
    },
  ],
  tools: [
    {
      slug: "acme-rtk",
      name: "rtk",
      owner: "acme",
      description: "Token-optimized CLI proxy",
      language: "Rust",
      topics: [],
      stars: 500,
      stars_gained: 100,
      trend_score: 40,
      ring: "assess",
      open_issues: 12,
      commit_activity: [3, 5, 2, 8],
      url: "https://github.com/acme/rtk",
      position: { x: 0, y: 0, z: 0 },
      cluster_id: 1,
      first_seen_at: "2026-01-01T00:00:00+00:00",
    },
    {
      slug: "acme-headroom",
      name: "headroom",
      owner: "acme",
      description: "Context compaction",
      language: "Go",
      topics: [],
      stars: 900,
      stars_gained: 300,
      trend_score: 70,
      ring: "trial",
      open_issues: 40,
      commit_activity: [10, 12, 9, 15],
      url: "https://github.com/acme/headroom",
      position: { x: 1, y: 0, z: 0 },
      cluster_id: 1,
      first_seen_at: "2026-01-02T00:00:00+00:00",
    },
  ],
};

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt(data, "https://airadar.dev");

  it("starts with the site title and purpose blockquote", () => {
    expect(text.startsWith("# AI Radar")).toBe(true);
    expect(text).toContain("> A live semantic landscape");
  });

  it("groups tools under their cluster heading, momentum first", () => {
    const clusterIndex = text.indexOf("## Token Usage");
    const headroomIndex = text.indexOf("acme/headroom");
    const rtkIndex = text.indexOf("acme/rtk");
    expect(clusterIndex).toBeGreaterThan(-1);
    expect(headroomIndex).toBeGreaterThan(clusterIndex);
    expect(rtkIndex).toBeGreaterThan(headroomIndex); // higher momentum listed first
  });

  it("links every tool to its canonical page", () => {
    expect(text).toContain("https://airadar.dev/tools/acme-rtk");
  });

  it("annotates each tool with its adoption ring", () => {
    expect(text).toContain("[trial]");
    expect(text).toContain("[assess]");
  });
});
