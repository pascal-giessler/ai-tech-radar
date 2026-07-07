import type { Ring } from "./types";

export interface RingMeta {
  slug: Ring;
  label: string;
  /** One-line meaning, shown in legends and the ring filter. */
  blurb: string;
  color: string;
  order: number;
}

// Inner (Adopt) to outer (Hold), mirroring the classic technology-radar rings.
// Colours run confident-green → amber → violet → muted-grey as conviction drops.
export const RINGS: RingMeta[] = [
  { slug: "adopt", label: "Adopt", blurb: "Proven and thriving — safe default", color: "#54e0c7", order: 0 },
  { slug: "trial", label: "Trial", blurb: "Real traction — worth piloting", color: "#7dd3fc", order: 1 },
  { slug: "assess", label: "Assess", blurb: "Emerging — worth watching", color: "#c4a3ff", order: 2 },
  { slug: "hold", label: "Hold", blurb: "Cooling or stalled — don't chase", color: "#8b94ad", order: 3 },
];

const BY_SLUG: Record<Ring, RingMeta> = Object.fromEntries(
  RINGS.map((r) => [r.slug, r]),
) as Record<Ring, RingMeta>;

export function ringMeta(ring: Ring): RingMeta {
  return BY_SLUG[ring];
}

// Normalised radius (0–1) for the 2D radar dial: each ring sits in the middle of
// its band so nodes never land exactly on a boundary line.
export function ringRadius(ring: Ring): number {
  const band = 1 / RINGS.length;
  return band * (BY_SLUG[ring].order + 0.5);
}
