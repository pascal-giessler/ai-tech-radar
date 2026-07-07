"use client";

import { useMemo } from "react";

import { RINGS } from "@/lib/rings";
import type { Ring, Tool } from "@/lib/types";

export type ViewMode = "galaxy" | "radar";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-hairline bg-dome/80 p-0.5 font-mono text-xs backdrop-blur">
      {(["galaxy", "radar"] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          aria-pressed={view === mode}
          className={`rounded-full px-3 py-1 transition-colors ${
            view === mode ? "bg-phosphor text-ink-sky" : "text-muted hover:text-phosphor"
          }`}
        >
          {mode === "galaxy" ? "galaxy" : "radar"}
        </button>
      ))}
    </div>
  );
}

/** Ring legend that doubles as a filter: click a ring to isolate it. */
export function RingLegend({
  tools,
  activeRings,
  onToggle,
}: {
  tools: Tool[];
  activeRings: Set<Ring>;
  onToggle: (ring: Ring) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { adopt: 0, trial: 0, assess: 0, hold: 0 };
    for (const t of tools) if (t.ring) c[t.ring]++;
    return c;
  }, [tools]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RINGS.map((ring) => {
        const active = activeRings.size === 0 || activeRings.has(ring.slug);
        return (
          <button
            key={ring.slug}
            onClick={() => onToggle(ring.slug)}
            aria-pressed={activeRings.has(ring.slug)}
            title={ring.blurb}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide transition-opacity ${
              active ? "opacity-100" : "opacity-40"
            }`}
            style={{ borderColor: `${ring.color}55` }}
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: ring.color }}
            />
            <span style={{ color: ring.color }}>{ring.label}</span>
            <span className="text-muted">{counts[ring.slug]}</span>
          </button>
        );
      })}
    </div>
  );
}
