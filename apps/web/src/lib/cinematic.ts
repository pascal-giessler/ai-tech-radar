import { formatStars } from "./format";
import type { Cluster, Ring, Tool } from "./types";

/* ---------- tiers (momentum) ---------- */

export type CineTier = "surging" | "rising" | "steady" | "watch";

export function cineTier(score: number): CineTier {
  return score >= 75 ? "surging" : score >= 40 ? "rising" : score >= 15 ? "steady" : "watch";
}

export const TIER_COLOR: Record<CineTier, string> = {
  surging: "#74e0ff",
  rising: "#5fe0c4",
  steady: "#8fb0c8",
  watch: "#6b8aa2",
};
export const TIER_BG: Record<CineTier, string> = {
  surging: "rgba(116,224,255,0.12)",
  rising: "rgba(95,224,196,0.12)",
  steady: "rgba(143,176,200,0.12)",
  watch: "rgba(107,138,162,0.14)",
};

/* ---------- adoption rings (the recommendation axis) ---------- */

export const RING_ORDER: Ring[] = ["adopt", "trial", "assess", "hold"];

/** Display titles for the adoption rings. (`RING_LABEL` below is the older
 *  momentum-tier ring geometry used by the radar canvas — kept distinct.) */
export const RING_TITLE: Record<Ring, string> = {
  adopt: "Adopt",
  trial: "Trial",
  assess: "Assess",
  hold: "Hold",
};

/** Semantic, not decorative: green = safe default, amber = watch, slate = don't chase. */
export const RING_COLOR: Record<Ring, string> = {
  adopt: "oklch(0.82 0.13 158)",
  trial: "oklch(0.82 0.13 210)",
  assess: "oklch(0.85 0.12 85)",
  hold: "oklch(0.72 0.045 255)",
};

export const RING_BG: Record<Ring, string> = {
  adopt: "oklch(0.82 0.13 158 / 0.13)",
  trial: "oklch(0.82 0.13 210 / 0.13)",
  assess: "oklch(0.85 0.12 85 / 0.13)",
  hold: "oklch(0.72 0.045 255 / 0.14)",
};

export const RING_MEANING: Record<Ring, string> = {
  adopt: "Proven and still thriving — a safe default.",
  trial: "Real traction — worth piloting.",
  assess: "Emerging and unproven — worth watching.",
  hold: "Cooling or stalled — don't chase.",
};

export function ringLabel(ring: Ring | null): string {
  return ring ? RING_TITLE[ring] : "Unrated";
}

export const ACCENT = "#74e0ff";
export const LIVE = "#57e0a8";
export const RING_R = [0.42, 0.656, 0.821, 0.93];
export const RING_LABEL: CineTier[] = ["surging", "rising", "steady", "watch"];
export const RING_TIER_COLOR = ["#74e0ff", "#5fe0c4", "#8fb0c8", "#6b8aa2"];
export const PING_DUR = 1.7;
export const STEPS = 13;
export const CY = "116,224,255";
export const COLOR_OPTS = [195, 235, 165, 55, 320, 285];

export { formatStars };

/* ---------- colour ---------- */

export function clusterHue(id: number): number {
  return ((id * 137.508) % 360 + 360) % 360;
}
/** Hue derived from the cluster SLUG, not its id. Cluster ids are reassigned on every
 *  recompute (the repo deletes + re-inserts); the slug is stable, so colours stay put
 *  as the landscape refreshes. Golden-angle spread keeps neighbours far apart. */
export function hueForSlug(slug: string): number {
  return ((hashSeed(slug) * 137.508) % 360 + 360) % 360;
}
export function clusterColor(hue: number, l = 0.78, c = 0.15, a?: number): string {
  return a == null ? `oklch(${l} ${c} ${hue})` : `oklch(${l} ${c} ${hue} / ${a})`;
}

/* ---------- deterministic rng ---------- */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- model ---------- */

export interface Hist {
  score: number;
  stars: number;
}
export interface ScopeNode {
  slug: string;
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  url: string;
  cid: number;
  clusterSlug: string;
  clusterLabel: string;
  score: number;
  stars: number;
  gained: number;
  bearing: number;
  rjit: number;
  hue: number;
  hay: string;
  pattern: string;
  hist: Hist[];
  tier: CineTier;
  ping: number;
  /** The adoption ring computed by the backend (adopt/trial/assess/hold), or null. */
  ring: Ring | null;
  openIssues: number;
  /** Real weekly commit counts, most-recent-last (up to ~12w); empty when unavailable. */
  commitActivity: number[];
  commitsRecent: number;
  /** ISO timestamp the tool was first discovered — powers "new entrants". */
  firstSeen: string;
}
export interface ScopeCluster {
  id: number;
  slug: string;
  label: string;
  hue: number;
  bearing: number;
  count: number;
  keywords: string[];
  description: string;
}
export interface ScopeModel {
  nodes: ScopeNode[];
  clusters: ScopeCluster[];
  maxStars: number;
}

const PATTERNS = ["emerging", "emerging", "breakout", "fading", "steady", "volatile"];

/** Deterministic 13-week momentum trajectory ending at the tool's real current
 *  score/stars. Weekly history isn't stored server-side yet — this is a modeled
 *  projection, stable per tool, honest about the present (last step is real). */
export function buildHist(endScore: number, endStars: number, pattern: string, rng: () => number): Hist[] {
  const S = STEPS;
  const H: Hist[] = [];
  const startFrac =
    ({ emerging: 0.34, breakout: 0.28, fading: 0.9, steady: 0.74, volatile: 0.58 } as Record<string, number>)[
      pattern
    ] ?? 0.6;
  for (let i = 0; i < S; i++) {
    const p = i / (S - 1);
    let sc: number;
    if (pattern === "emerging") sc = endScore * (0.12 + 0.88 * Math.pow(p, 1.7));
    else if (pattern === "breakout")
      sc = p < 0.6 ? endScore * 0.16 * (p / 0.6) : endScore * (0.16 + 0.84 * ((p - 0.6) / 0.4));
    else if (pattern === "fading") {
      const peak = Math.min(98, endScore + 34);
      sc = peak - (peak - endScore) * Math.pow(p, 0.75);
    } else if (pattern === "steady") sc = endScore * (0.8 + 0.2 * p);
    else sc = endScore * (0.62 + 0.38 * p) + Math.sin(i * 1.7) * 9;
    sc += (rng() - 0.5) * 6;
    sc = Math.max(2, Math.min(99, sc));
    const stars = Math.round(
      endStars * (startFrac + (1 - startFrac) * Math.pow(p, pattern === "emerging" || pattern === "breakout" ? 1.5 : 1)),
    );
    H.push({ score: Math.round(sc), stars });
  }
  H[S - 1] = { score: endScore, stars: endStars };
  return H;
}

export function sampleHist(node: ScopeNode, tf: number): Hist {
  const i0 = Math.max(0, Math.min(STEPS - 1, Math.floor(tf)));
  const i1 = Math.min(STEPS - 1, i0 + 1);
  const f = tf - i0;
  const a = node.hist[i0];
  const b = node.hist[i1];
  return { score: a.score + (b.score - a.score) * f, stars: Math.round(a.stars + (b.stars - a.stars) * f) };
}

export function buildModel(tools: Tool[], clusters: Cluster[]): ScopeModel {
  const meta = new Map(clusters.map((c) => [c.id, c]));
  const usedIds = Array.from(new Set(tools.map((t) => t.cluster_id ?? 0))).sort((a, b) => a - b);
  const N = Math.max(usedIds.length, 1);
  const sector = (Math.PI * 2) / N;
  const bearingById = new Map<number, number>();
  usedIds.forEach((id, k) => bearingById.set(id, (k / N) * Math.PI * 2 - Math.PI / 2));

  const counts = new Map<number, number>();
  const nodes: ScopeNode[] = tools.map((t) => {
    const cid = t.cluster_id ?? 0;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
    const rng = mulberry32(hashSeed(t.slug));
    const base = bearingById.get(cid) ?? 0;
    const score = Math.round(t.trend_score);
    const clusterSlug = meta.get(cid)?.slug ?? "uncharted";
    const label = meta.get(cid)?.label ?? "uncharted";
    const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
    const commitActivity = Array.isArray(t.commit_activity) ? t.commit_activity : [];
    return {
      slug: t.slug,
      owner: t.owner,
      name: t.name,
      description: t.description,
      language: t.language,
      topics: t.topics,
      url: t.url,
      cid,
      clusterSlug,
      clusterLabel: label,
      score,
      stars: t.stars,
      gained: Math.max(0, t.stars_gained),
      bearing: base + (rng() - 0.5) * sector * 0.66,
      rjit: (rng() - 0.5) * 0.05,
      hue: hueForSlug(clusterSlug),
      hay: `${t.owner}/${t.name} ${t.description} ${t.topics.join(" ")}`.toLowerCase(),
      pattern,
      hist: buildHist(score, t.stars, pattern, rng),
      tier: cineTier(score),
      ping: -99,
      ring: t.ring,
      openIssues: t.open_issues ?? 0,
      commitActivity,
      commitsRecent: commitActivity.reduce((a, b) => a + b, 0),
      firstSeen: t.first_seen_at ?? "",
    };
  });

  const scopeClusters: ScopeCluster[] = usedIds.map((id) => {
    const c = meta.get(id);
    const slug = c?.slug ?? "uncharted";
    return {
      id,
      slug,
      label: c?.label ?? "uncharted",
      hue: hueForSlug(slug),
      bearing: bearingById.get(id) ?? 0,
      count: counts.get(id) ?? 0,
      keywords: c?.keywords ?? [],
      description: c?.description ?? "",
    };
  });

  return { nodes, clusters: scopeClusters, maxStars: Math.max(1, ...nodes.map((n) => n.stars)) };
}

export const PATTERN_LABEL: Record<string, string> = {
  emerging: "emerging",
  breakout: "breakout",
  fading: "cooling",
  steady: "steady",
  volatile: "volatile",
};
