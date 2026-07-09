import { formatStars } from "./cinematic";
import { SCORE_WARM, STAR_ESTABLISHED, STAR_MATURE } from "./quadrant";

/**
 * Plain-language explanations of the two computed signals, kept in one place so
 * every tooltip tells the same story. Thresholds mirror the backend
 * TrendScorer / AdoptionClassifier.
 */
export const SCORE_EXPLAINER =
  "Momentum score (0–100): mostly recent star growth, boosted up to 1.5× for repos under 30 days old, plus a small bonus for absolute size. Capped at 100.";

export const RING_EXPLAINER =
  "Adoption ring from momentum × maturity — below 18 momentum it's Hold; otherwise by stars: under 2k Assess, 2k–50k Trial, 50k+ Adopt.";

/** One-line reason a specific tool landed in its ring (same rule as the backend). */
export function ringReason(stars: number, score: number): string {
  const s = `${formatStars(stars)}★`;
  if (score < SCORE_WARM) return `momentum ${Math.round(score)} < ${SCORE_WARM} → cooling / stalled`;
  if (stars >= STAR_MATURE) return `warm & ${s} (≥50k) → proven staple`;
  if (stars >= STAR_ESTABLISHED) return `warm & ${s} (2k–50k) → real traction`;
  return `warm but ${s} (<2k) → emerging, unproven`;
}
