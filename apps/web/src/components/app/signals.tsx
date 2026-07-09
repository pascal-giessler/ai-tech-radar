"use client";

import { RING_BG, RING_COLOR, ringLabel } from "@/lib/cinematic";
import type { Ring } from "@/lib/types";

/** Adoption-ring pill. Colour is semantic (green = adopt … slate = hold). */
export function RingPill({ ring, size = "sm" }: { ring: Ring | null; size?: "sm" | "md" }) {
  const pad = size === "md" ? "px-[11px] py-1 text-[11px]" : "px-[9px] py-[3px] text-[10px]";
  if (ring === null) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-[0.08em] ${pad}`}
        style={{ background: "rgba(120,150,170,0.1)", color: "#6b8aa2" }}
      >
        unrated
      </span>
    );
  }
  const color = RING_COLOR[ring];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-[0.08em] ${pad}`}
      style={{ background: RING_BG[ring], color }}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: color }} />
      {ringLabel(ring)}
    </span>
  );
}

/**
 * Real weekly-commit sparkbars. `weeks` is most-recent-last. Renders up to the last
 * `count` weeks, normalised to the local peak. Honest empty state when GitHub gave
 * us no stats.
 */
export function ActivityBars({
  weeks,
  count = 12,
  color = "#57e0a8",
  height = 22,
}: {
  weeks: number[];
  count?: number;
  color?: string;
  height?: number;
}) {
  const series = weeks.slice(-count);
  if (series.length === 0) {
    return <span className="font-mono text-[10.5px] text-[#4d6f86]">no commit data</span>;
  }
  const peak = Math.max(1, ...series);
  return (
    <span
      className="inline-flex items-end gap-[2px]"
      style={{ height }}
      title={`${series.reduce((a, b) => a + b, 0)} commits over the last ${series.length} weeks`}
    >
      {series.map((v, i) => (
        <span
          key={i}
          className="w-[3px] flex-none rounded-[1px]"
          style={{
            height: `${Math.max(6, (v / peak) * 100)}%`,
            background: v === 0 ? "rgba(116,224,255,0.14)" : color,
            opacity: v === 0 ? 1 : 0.55 + 0.45 * (v / peak),
          }}
        />
      ))}
    </span>
  );
}
