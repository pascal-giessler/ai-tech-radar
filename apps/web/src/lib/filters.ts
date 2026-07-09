import type { CineTier, ScopeNode } from "./cinematic";
import type { Ring } from "./types";

/**
 * Composable record filters. Every dimension is "empty = no constraint", so an
 * all-empty filter set (plus empty query) passes every node through unchanged.
 */
export interface RecordFilters {
  /** Cluster slugs to keep. */
  clusters: string[];
  rings: Ring[];
  tiers: CineTier[];
  /** Languages to keep (case-sensitive as GitHub reports them). */
  langs: string[];
  /** Minimum momentum score (0–100). */
  minScore: number;
}

export const EMPTY_FILTERS: RecordFilters = {
  clusters: [],
  rings: [],
  tiers: [],
  langs: [],
  minScore: 0,
};

/** How many filter dimensions are currently narrowing the set. */
export function activeFilterCount(f: RecordFilters): number {
  return (
    f.clusters.length +
    f.rings.length +
    f.tiers.length +
    f.langs.length +
    (f.minScore > 0 ? 1 : 0)
  );
}

export function isFiltering(f: RecordFilters, query: string): boolean {
  return activeFilterCount(f) > 0 || query.trim().length > 0;
}

/** Pure predicate over a single node; exported for reuse (e.g. overview honoring filters). */
export function matchesFilters(node: ScopeNode, f: RecordFilters): boolean {
  if (f.clusters.length && !f.clusters.includes(node.clusterSlug)) return false;
  if (f.rings.length && (node.ring === null || !f.rings.includes(node.ring))) return false;
  if (f.tiers.length && !f.tiers.includes(node.tier)) return false;
  if (f.langs.length && !f.langs.includes(node.language ?? "")) return false;
  if (node.score < f.minScore) return false;
  return true;
}

/** Apply filters + free-text query (matched against the node's precomputed haystack). */
export function filterNodes(nodes: ScopeNode[], f: RecordFilters, query: string): ScopeNode[] {
  const q = query.trim().toLowerCase();
  return nodes.filter((n) => matchesFilters(n, f) && (q === "" || n.hay.includes(q)));
}

/** Toggle a value in a string/enum multi-select array (immutable). */
export function toggleValue<T extends string>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
