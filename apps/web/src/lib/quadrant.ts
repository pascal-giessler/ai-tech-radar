import type { Ring } from "./types";

/**
 * Geometry for the Trend Quadrant: maturity (log stars, x) × momentum (score, y).
 * Threshold values mirror the backend AdoptionClassifier so the reference lines
 * line up with the real ring boundaries (see radar-rings addendum).
 */
export const STAR_ESTABLISHED = 1_500;
export const STAR_MATURE = 15_000;
export const SCORE_WARM = 18;
export const SCORE_HOT = 45;

// Plot insets: dots are anchored by their centre, so map data into an inner band
// rather than the full 0..1 frame — otherwise a max-momentum (score 100) or
// min-star tool sits on the frame and gets clipped in half. Every position (dots,
// threshold lines, region labels) flows through xFrac/yFrac, so insetting here
// keeps them all aligned.
const X_LEFT = 0.03;
const X_RIGHT = 0.97;
const Y_BOTTOM = 0.05;
const Y_TOP = 0.93;

export function logStars(stars: number): number {
  return Math.log10(Math.max(1, stars));
}

/** log-star domain padded a little past the data so no bubble sits on the frame. */
export function starDomain(starCounts: number[]): [number, number] {
  const logs = starCounts.map(logStars);
  const min = Math.min(logStars(STAR_ESTABLISHED / 4), ...logs);
  const max = Math.max(logStars(STAR_MATURE * 2), ...logs);
  return [Math.floor(min * 2) / 2, Math.ceil(max * 2) / 2];
}

/** Normalise a star count into the plot's inner horizontal band. */
export function xFrac(stars: number, [min, max]: [number, number]): number {
  if (max <= min) return (X_LEFT + X_RIGHT) / 2;
  const t = Math.max(0, Math.min(1, (logStars(stars) - min) / (max - min)));
  return X_LEFT + t * (X_RIGHT - X_LEFT);
}

/** Momentum score (0..100) into the plot's inner vertical band. */
export function yFrac(score: number): number {
  const t = Math.max(0, Math.min(1, score / 100));
  return Y_BOTTOM + t * (Y_TOP - Y_BOTTOM);
}

/**
 * Deterministic ±`amount` offset keyed on a slug. Momentum saturates at 100 for
 * many popular tools, so without this they stack into one clipped line at the top;
 * a stable per-tool jitter relieves the overplotting without moving on re-render.
 */
export function jitter(slug: string, amount: number): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (Math.imul(h, 31) + slug.charCodeAt(i)) | 0;
  const unit = (h >>> 0) / 0xffffffff; // 0..1
  return (unit - 0.5) * 2 * amount;
}

/** Bubble radius from 30-day gain, sqrt-scaled so area (not radius) tracks gain. */
export function bubbleRadius(gain: number, maxGain: number, min = 3, max = 15): number {
  if (maxGain <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.max(0, gain) / maxGain);
}

export interface QuadrantRegion {
  ring: Ring;
  label: string;
  /** Anchor in 0..1 fractional space (x from left, y from bottom). */
  x: number;
  y: number;
}

/** Indicative region anchors for labelling (dot colour remains the source of truth). */
export function regionAnchors(domain: [number, number]): QuadrantRegion[] {
  const xMature = xFrac(STAR_MATURE, domain);
  const xEstablished = xFrac(STAR_ESTABLISHED, domain);
  return [
    { ring: "adopt", label: "Adopt", x: (xMature + X_RIGHT) / 2, y: 0.8 },
    { ring: "trial", label: "Trial", x: (xEstablished + xMature) / 2, y: 0.66 },
    { ring: "assess", label: "Assess", x: (X_LEFT + xEstablished) / 2, y: 0.8 },
    { ring: "hold", label: "Hold", x: 0.5, y: 0.1 },
  ];
}
