import { describe, expect, it } from "vitest";

import { buildModel, hueForSlug } from "./cinematic";
import type { Cluster, Ring, Tool } from "./types";

function tool(over: Partial<Tool> = {}): Tool {
  return {
    slug: "acme-widget",
    name: "widget",
    owner: "acme",
    description: "a thing",
    language: "Rust",
    topics: [],
    stars: 100,
    stars_gained: 10,
    trend_score: 42,
    ring: "trial" as Ring,
    open_issues: 5,
    commit_activity: [1, 2, 3],
    url: "https://github.com/acme/widget",
    position: { x: 0, y: 0, z: 0 },
    cluster_id: 1,
    first_seen_at: "2026-01-01T00:00:00+00:00",
    ...over,
  };
}

const cluster: Cluster = {
  id: 1,
  label: "Agents",
  slug: "agents",
  size: 1,
  centroid: { x: 0, y: 0, z: 0 },
  keywords: ["agents", "tools"],
  description: "1 tool grouped by semantic similarity.",
};

describe("buildModel", () => {
  it("carries the backend adoption ring and activity signals onto nodes", () => {
    const { nodes } = buildModel([tool({ ring: "adopt", open_issues: 7, commit_activity: [4, 6] })], [cluster]);
    expect(nodes[0].ring).toBe("adopt");
    expect(nodes[0].openIssues).toBe(7);
    expect(nodes[0].commitActivity).toEqual([4, 6]);
    expect(nodes[0].commitsRecent).toBe(10);
  });

  it("tolerates a null ring and missing activity", () => {
    const { nodes } = buildModel(
      [tool({ ring: null, commit_activity: [] })],
      [cluster],
    );
    expect(nodes[0].ring).toBeNull();
    expect(nodes[0].commitsRecent).toBe(0);
  });

  it("colours nodes and clusters from the cluster SLUG (stable across id churn)", () => {
    const a = buildModel([tool({ cluster_id: 1 })], [{ ...cluster, id: 1 }]);
    // same slug, different id (as happens after a recompute) => identical hue
    const b = buildModel([tool({ cluster_id: 9 })], [{ ...cluster, id: 9 }]);
    expect(a.clusters[0].hue).toBe(b.clusters[0].hue);
    expect(a.nodes[0].hue).toBe(hueForSlug("agents"));
  });
});

describe("hueForSlug", () => {
  it("is deterministic and in range", () => {
    expect(hueForSlug("agents")).toBe(hueForSlug("agents"));
    expect(hueForSlug("rag")).toBeGreaterThanOrEqual(0);
    expect(hueForSlug("rag")).toBeLessThan(360);
  });
});
