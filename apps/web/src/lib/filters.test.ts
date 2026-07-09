import { describe, expect, it } from "vitest";

import { buildModel } from "./cinematic";
import { EMPTY_FILTERS, activeFilterCount, filterNodes, toggleValue } from "./filters";
import type { Cluster, Ring, Tool } from "./types";

function tool(over: Partial<Tool>): Tool {
  return {
    slug: over.slug ?? "s",
    name: over.name ?? "n",
    owner: over.owner ?? "o",
    description: over.description ?? "",
    language: over.language ?? "Rust",
    topics: over.topics ?? [],
    stars: over.stars ?? 100,
    stars_gained: over.stars_gained ?? 0,
    trend_score: over.trend_score ?? 50,
    ring: (over.ring ?? "trial") as Ring,
    open_issues: over.open_issues ?? 0,
    commit_activity: over.commit_activity ?? [],
    url: over.url ?? "u",
    position: over.position ?? { x: 0, y: 0, z: 0 },
    cluster_id: over.cluster_id ?? 1,
    first_seen_at: over.first_seen_at ?? "2026-01-01T00:00:00+00:00",
  };
}

const clusters: Cluster[] = [
  { id: 1, label: "Agents", slug: "agents", size: 2, centroid: { x: 0, y: 0, z: 0 }, keywords: [], description: "" },
  { id: 2, label: "RAG", slug: "rag", size: 1, centroid: { x: 0, y: 0, z: 0 }, keywords: [], description: "" },
];

const { nodes } = buildModel(
  [
    tool({ slug: "a", trend_score: 90, ring: "adopt", language: "Go", cluster_id: 1, topics: ["x"] }),
    tool({ slug: "b", trend_score: 30, ring: "hold", language: "Rust", cluster_id: 1 }),
    tool({ slug: "c", trend_score: 60, ring: "trial", language: "Python", cluster_id: 2 }),
  ],
  clusters,
);

describe("filterNodes", () => {
  it("passes everything through when empty", () => {
    expect(filterNodes(nodes, EMPTY_FILTERS, "").length).toBe(3);
  });

  it("filters by cluster slug", () => {
    const out = filterNodes(nodes, { ...EMPTY_FILTERS, clusters: ["rag"] }, "");
    expect(out.map((n) => n.slug)).toEqual(["c"]);
  });

  it("filters by ring", () => {
    const out = filterNodes(nodes, { ...EMPTY_FILTERS, rings: ["adopt", "hold"] }, "");
    expect(out.map((n) => n.slug).sort()).toEqual(["a", "b"]);
  });

  it("filters by language", () => {
    const out = filterNodes(nodes, { ...EMPTY_FILTERS, langs: ["Rust"] }, "");
    expect(out.map((n) => n.slug)).toEqual(["b"]);
  });

  it("filters by minimum score", () => {
    const out = filterNodes(nodes, { ...EMPTY_FILTERS, minScore: 61 }, "");
    expect(out.map((n) => n.slug)).toEqual(["a"]);
  });

  it("composes dimensions with the free-text query", () => {
    const out = filterNodes(nodes, { ...EMPTY_FILTERS, clusters: ["agents"] }, "o/n");
    expect(out.length).toBe(2); // both agents nodes match owner/name haystack
  });
});

describe("activeFilterCount / toggleValue", () => {
  it("counts narrowed dimensions including minScore", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, rings: ["adopt"], minScore: 10 })).toBe(2);
  });

  it("toggles values in and out", () => {
    expect(toggleValue<string>([], "a")).toEqual(["a"]);
    expect(toggleValue<string>(["a"], "a")).toEqual([]);
  });
});
