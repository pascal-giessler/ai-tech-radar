"use client";

import { useMemo } from "react";

import { RING_COLOR, RING_ORDER, formatStars, ringLabel, type ScopeNode } from "@/lib/cinematic";
import { RING_EXPLAINER } from "@/lib/explain";
import type { Ring } from "@/lib/types";

import { InfoTip } from "./InfoTip";

const card =
  "rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-4 backdrop-blur-[16px]";

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function Stat({ value, label, tip }: { value: string; label: string; tip?: string }) {
  return (
    <div className={`${card} min-w-0`}>
      <div className="font-mono text-[22px] leading-none text-[#eaf7ff]">{value}</div>
      <div className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f8299]">
        {label} {tip && <InfoTip text={tip} />}
      </div>
    </div>
  );
}

/** Headline numbers for the current landscape. */
export function StatStrip({ nodes, clusterCount }: { nodes: ScopeNode[]; clusterCount: number }) {
  const { movers, medMomentum, topStars } = useMemo(() => {
    return {
      movers: nodes.filter((n) => n.gained > 0).length,
      medMomentum: median(nodes.map((n) => n.score)),
      topStars: Math.max(0, ...nodes.map((n) => n.stars)),
    };
  }, [nodes]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat value={String(nodes.length)} label="tools tracked" />
      <Stat value={String(clusterCount)} label="clusters" />
      <Stat
        value={String(medMomentum)}
        label="median momentum"
        tip="The middle momentum score across all visible tools — a pulse of how fast the whole area is moving."
      />
      <Stat value={`${movers}`} label="moving (30d)" tip="Tools that gained stars in the last 30 days." />
      <div className="col-span-2 sm:hidden">
        <Stat value={`★ ${formatStars(topStars)}`} label="most stars" />
      </div>
    </div>
  );
}

/** Stacked adoption-ring profile — how mature the tracked area is overall. */
export function RingDistribution({ nodes }: { nodes: ScopeNode[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { adopt: 0, trial: 0, assess: 0, hold: 0, unrated: 0 };
    for (const n of nodes) c[n.ring ?? "unrated"]++;
    return c;
  }, [nodes]);
  const total = nodes.length || 1;
  const rings: (Ring | "unrated")[] = [...RING_ORDER, "unrated"];
  const color = (r: Ring | "unrated") => (r === "unrated" ? "#6b8aa2" : RING_COLOR[r]);

  return (
    <div className={card}>
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-semibold text-[#eaf7ff]">Adoption profile</h3>
        <InfoTip text={RING_EXPLAINER} />
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {rings.map((r) =>
          counts[r] ? (
            <div
              key={r}
              title={`${ringLabel(r === "unrated" ? null : r)}: ${counts[r]}`}
              style={{ width: `${(counts[r] / total) * 100}%`, background: color(r) }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {rings.map((r) =>
          counts[r] ? (
            <span key={r} className="flex items-center gap-1.5 font-mono text-[11px] text-[#93b4c9]">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: color(r) }} />
              {ringLabel(r === "unrated" ? null : r)}
              <span className="text-[#e2f3ff]">{counts[r]}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Top languages by tool count — what the ecosystem is built in. */
export function LanguageMix({ nodes }: { nodes: ScopeNode[] }) {
  const top = useMemo(() => {
    const tally = new Map<string, number>();
    for (const n of nodes) {
      if (!n.language) continue;
      tally.set(n.language, (tally.get(n.language) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [nodes]);

  const max = Math.max(1, ...top.map(([, c]) => c));

  return (
    <div className={card}>
      <h3 className="mb-3 text-[13.5px] font-semibold text-[#eaf7ff]">Built with</h3>
      {top.length === 0 ? (
        <div className="font-mono text-[11px] text-[#4d6f86]">No language data yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {top.map(([lang, count]) => (
            <div key={lang} className="flex items-center gap-3">
              <span className="w-24 flex-none truncate text-[12px] text-[#cfeaf9]">{lang}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(116,224,255,0.08)]">
                <span
                  className="block h-full rounded-full bg-[#74e0ff]"
                  style={{ width: `${(count / max) * 100}%`, opacity: 0.7 }}
                />
              </span>
              <span className="w-6 flex-none text-right font-mono text-[11px] text-[#5f8299]">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
