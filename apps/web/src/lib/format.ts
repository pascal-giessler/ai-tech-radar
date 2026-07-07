export function formatStars(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export type Tier = "blazing" | "rising" | "steady" | "quiet";

export function scoreTier(score: number): Tier {
  if (score >= 75) return "blazing";
  if (score >= 40) return "rising";
  if (score >= 15) return "steady";
  return "quiet";
}

/** Golden-angle hue spacing: consecutive cluster ids land far apart on the wheel. */
export function clusterHue(clusterId: number): number {
  const GOLDEN_ANGLE = 137.508;
  return ((clusterId * GOLDEN_ANGLE) % 360 + 360) % 360;
}
