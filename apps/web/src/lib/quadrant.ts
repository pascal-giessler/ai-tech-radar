import type { Ring } from "./types";

/**
 * Geometry for the Trend Quadrant: maturity (log stars, x) × momentum (score, y).
 *
 * These thresholds MUST match the backend AdoptionClassifier exactly — the ring is
 * a pure function of (stars, trend_score), so the plot's zones ARE the ring
 * boundaries and every dot's colour matches the zone it sits in:
 *   momentum < WARM            -> Hold   (any maturity)
 *   momentum >= WARM, stars <  ESTABLISHED -> Assess
 *   momentum >= WARM, stars in [ESTABLISHED, MATURE) -> Trial
 *   momentum >= WARM, stars >= MATURE      -> Adopt
 * (see apps/api/.../domain/services/adoption_classifier.py)
 */
export const STAR_ESTABLISHED = 2_000; // AdoptionClassifier.ESTABLISHED_STARS
export const STAR_MATURE = 50_000; // AdoptionClassifier.MATURE_STARS
export const SCORE_WARM = 18; // AdoptionClassifier.WARM_SCORE

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

export interface QuadrantZone {
  ring: Ring;
  label: string;
  /** Rect in 0..1 fractional space (x from left, y from bottom). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * The four ring zones, drawn from the exact classifier thresholds so a dot's
 * colour always agrees with the zone it lands in. Hold is the full-width band
 * below WARM momentum; above it, maturity splits Assess | Trial | Adopt.
 */
export function quadrantZones(domain: [number, number]): QuadrantZone[] {
  const xEst = xFrac(STAR_ESTABLISHED, domain);
  const xMat = xFrac(STAR_MATURE, domain);
  const yWarm = yFrac(SCORE_WARM);
  return [
    { ring: "hold", label: "Hold", x0: 0, x1: 1, y0: 0, y1: yWarm },
    { ring: "assess", label: "Assess", x0: 0, x1: xEst, y0: yWarm, y1: 1 },
    { ring: "trial", label: "Trial", x0: xEst, x1: xMat, y0: yWarm, y1: 1 },
    { ring: "adopt", label: "Adopt", x0: xMat, x1: 1, y0: yWarm, y1: 1 },
  ];
}

/** Fractional x/y of the ring boundary lines, for drawing reference gridlines. */
export function boundaryLines(domain: [number, number]): {
  warmY: number;
  establishedX: number;
  matureX: number;
} {
  return {
    warmY: yFrac(SCORE_WARM),
    establishedX: xFrac(STAR_ESTABLISHED, domain),
    matureX: xFrac(STAR_MATURE, domain),
  };
}
