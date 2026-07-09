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

/** Normalise a star count to 0..1 across the domain. */
export function xFrac(stars: number, [min, max]: [number, number]): number {
  if (max <= min) return 0.5;
  return (logStars(stars) - min) / (max - min);
}

/** Momentum score (0..100) to 0..1. */
export function yFrac(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
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
    { ring: "adopt", label: "Adopt", x: (xMature + 1) / 2, y: 0.82 },
    { ring: "trial", label: "Trial", x: (xEstablished + xMature) / 2, y: 0.68 },
    { ring: "assess", label: "Assess", x: xEstablished / 2, y: 0.82 },
    { ring: "hold", label: "Hold", x: 0.5, y: 0.09 },
  ];
}
