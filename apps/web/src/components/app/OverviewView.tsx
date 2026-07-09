"use client";

import { useMemo, useState } from "react";

import {
  RING_BG,
  RING_COLOR,
  RING_MEANING,
  clusterColor,
  formatStars,
  ringLabel,
  type ScopeCluster,
  type ScopeNode,
} from "@/lib/cinematic";
import {
  SCORE_WARM,
  boundaryLines,
  bubbleRadius,
  jitter,
  quadrantZones,
  starDomain,
  xFrac,
  yFrac,
} from "@/lib/quadrant";
import { ringReason } from "@/lib/explain";
import type { Ring } from "@/lib/types";

import { InsightsSection } from "./Insights";
import { ActivityBars, RingPill } from "./signals";

function dominantRing(nodes: ScopeNode[]): Ring | null {
  const counts = new Map<Ring, number>();
  for (const n of nodes) if (n.ring) counts.set(n.ring, (counts.get(n.ring) ?? 0) + 1);
  let best: Ring | null = null;
  let max = 0;
  for (const [ring, c] of counts) if (c > max) ((max = c), (best = ring));
  return best;
}

function TrendQuadrant({ nodes, onPick }: { nodes: ScopeNode[]; onPick: (slug: string) => void }) {
  const [hover, setHover] = useState<ScopeNode | null>(null);
  const domain = useMemo(() => starDomain(nodes.map((n) => n.stars)), [nodes]);
  const maxGain = useMemo(() => Math.max(1, ...nodes.map((n) => n.gained)), [nodes]);

  const zones = quadrantZones(domain);
  const { warmY, establishedX, matureX } = boundaryLines(domain);

  return (
    <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[0.01em] text-[#eaf7ff]">Trend Quadrant</h2>
        <span className="font-mono text-[10.5px] text-[#5f8299]">momentum × maturity · zones are the adoption rings</span>
      </div>
      <p className="mb-4 max-w-[76ch] text-[12px] leading-[1.5] text-[#6f92a8]">
        Placed by maturity (stars, log) and momentum. The ring is decided by exactly these two axes, so a dot always
        sits in its own coloured zone: below the momentum line everything is <span className="text-[#93b4c9]">Hold</span>;
        above it, maturity splits <span style={{ color: RING_COLOR.assess }}>Assess</span> →{" "}
        <span style={{ color: RING_COLOR.trial }}>Trial</span> → <span style={{ color: RING_COLOR.adopt }}>Adopt</span>{" "}
        at 2k and 50k stars.
      </p>
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] text-[#5f8299]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6b8aa2]" />
        <span className="inline-block h-3 w-3 rounded-full bg-[#6b8aa2]" />
        <span>dot size = stars gained in the last 30 days (bigger = growing faster)</span>
      </div>

      <div className="flex gap-3">
        {/* y-axis caption */}
        <div className="flex w-4 flex-none items-center justify-center">
          <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#5f8299]" style={{ transform: "rotate(180deg)", writingMode: "vertical-rl" }}>
            momentum →
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-[clamp(320px,52vh,540px)] w-full overflow-hidden rounded-xl border border-[rgba(116,224,255,0.08)] bg-[rgba(4,9,16,0.5)]">
            {/* ring zones — the classifier's exact boundaries, so dot colour = zone */}
            {zones.map((z) => (
              <div
                key={z.label}
                className="pointer-events-none absolute"
                style={{
                  left: `${z.x0 * 100}%`,
                  bottom: `${z.y0 * 100}%`,
                  width: `${(z.x1 - z.x0) * 100}%`,
                  height: `${(z.y1 - z.y0) * 100}%`,
                  background: RING_BG[z.ring],
                }}
              >
                <span
                  className="absolute left-2 top-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: RING_COLOR[z.ring], opacity: 0.65 }}
                >
                  {z.label}
                </span>
              </div>
            ))}
            {/* boundary lines: momentum (Hold) full width, maturity splits above it */}
            <div className="pointer-events-none absolute inset-x-0" style={{ bottom: `${warmY * 100}%` }}>
              <div className="w-full" style={{ height: 1, background: "rgba(116,224,255,0.18)" }} />
              <span className="absolute -top-3 right-1 font-mono text-[9px] text-[#5f8299]">momentum {SCORE_WARM}</span>
            </div>
            {[
              { x: establishedX, label: "2k" },
              { x: matureX, label: "50k" },
            ].map((v) => (
              <div key={v.label} className="pointer-events-none absolute" style={{ left: `${v.x * 100}%`, bottom: `${warmY * 100}%`, top: 0 }}>
                <div className="h-full w-px" style={{ background: "rgba(116,224,255,0.14)" }} />
                <span className="absolute bottom-1 left-1 font-mono text-[9px] text-[#5f8299]">{v.label}</span>
              </div>
            ))}

            {nodes.map((n) => {
              const r = bubbleRadius(n.gained, maxGain);
              const isHover = hover?.slug === n.slug;
              // Vertical jitter only, so the saturation pileup spreads without pushing
              // a dot across a vertical ring boundary (which would break colour = zone).
              const left = xFrac(n.stars, domain) * 100;
              const bottom = (yFrac(n.score) + jitter(n.slug, 0.018)) * 100;
              return (
                <button
                  key={n.slug}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover((h) => (h?.slug === n.slug ? null : h))}
                  onClick={() => onPick(n.slug)}
                  aria-label={`${n.owner}/${n.name}`}
                  className="absolute -translate-x-1/2 translate-y-1/2 rounded-full transition-transform duration-150"
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                    width: r * 2,
                    height: r * 2,
                    background: n.ring ? RING_COLOR[n.ring] : "#6b8aa2",
                    opacity: isHover ? 1 : 0.72,
                    border: `1px solid ${clusterColor(n.hue, 0.85, 0.12)}`,
                    boxShadow: isHover ? `0 0 0 3px rgba(116,224,255,0.25)` : "none",
                    transform: `translate(-50%, 50%) scale(${isHover ? 1.25 : 1})`,
                    zIndex: isHover ? 20 : 1,
                  }}
                />
              );
            })}

            {hover && (
              <div
                className="pointer-events-none absolute z-30 -translate-x-1/2 translate-y-2 rounded-lg border border-[rgba(116,224,255,0.24)] bg-[rgba(9,17,28,0.96)] px-3 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-[12px]"
                style={{
                  left: `${Math.min(88, Math.max(12, xFrac(hover.stars, domain) * 100))}%`,
                  bottom: `${Math.min(86, yFrac(hover.score) * 100) + 4}%`,
                }}
              >
                <div className="whitespace-nowrap text-[12.5px] font-semibold text-[#eaf7ff]">
                  {hover.owner}/{hover.name}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-[#93b4c9]">
                  <span style={{ color: hover.ring ? RING_COLOR[hover.ring] : "#6b8aa2" }}>{ringLabel(hover.ring)}</span>
                  <span>· ★ {formatStars(hover.stars)}</span>
                  <span>· momentum {hover.score}</span>
                </div>
                <div className="mt-1 max-w-[220px] text-[10.5px] leading-[1.4] text-[#6f92a8]">
                  {ringReason(hover.stars, hover.score)}
                </div>
              </div>
            )}
          </div>
          <div className="mt-1.5 text-center font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#5f8299]">
            maturity — total stars (log) →
          </div>
        </div>
      </div>
    </div>
  );
}

function ClusterStrip({
  clusters,
  nodes,
  onOpenCluster,
}: {
  clusters: ScopeCluster[];
  nodes: ScopeNode[];
  onOpenCluster: (slug: string) => void;
}) {
  const rows = useMemo(() => {
    return clusters
      .map((c) => {
        const members = nodes.filter((n) => n.clusterSlug === c.slug);
        const avg = members.length ? Math.round(members.reduce((a, n) => a + n.score, 0) / members.length) : 0;
        const gained = members.reduce((a, n) => a + n.gained, 0);
        return { c, count: members.length, avg, gained, ring: dominantRing(members) };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [clusters, nodes]);

  return (
    <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 backdrop-blur-[16px]">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-[#eaf7ff]">Categories by momentum</h2>
        <span className="font-mono text-[10px] text-[#5f8299]">{rows.length} active</span>
      </div>
      <div className="flex flex-col divide-y divide-[rgba(116,224,255,0.07)]">
        {rows.map(({ c, count, avg, gained, ring }) => (
          <button
            key={c.slug}
            onClick={() => onOpenCluster(c.slug)}
            className="group flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-[rgba(116,224,255,0.04)]"
          >
            <span className="h-[10px] w-[10px] flex-none rounded-[3px]" style={{ background: clusterColor(c.hue, 0.78, 0.15) }} />
            <span className="w-[30%] min-w-0 truncate text-[13px] text-[#c6deec] group-hover:text-[#eaf7ff]">{c.label}</span>
            <span className="font-mono text-[11px] text-[#5f8299]">{count}</span>
            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[rgba(116,224,255,0.08)]">
              <div className="h-full rounded-full" style={{ width: `${avg}%`, background: clusterColor(c.hue, 0.8, 0.14) }} />
            </div>
            <span className="w-9 flex-none text-right font-mono text-[11px] text-[#e2f3ff]">{avg}</span>
            <span className="w-14 flex-none text-right font-mono text-[11px] text-[#57e0a8]">
              {gained > 0 ? "+" + formatStars(gained) : "—"}
            </span>
            {ring && <span className="hidden flex-none sm:inline"><RingPill ring={ring} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function TopMovers({ nodes, onPick }: { nodes: ScopeNode[]; onPick: (slug: string) => void }) {
  const movers = useMemo(
    () => nodes.filter((n) => n.gained > 0).sort((a, b) => b.gained - a.gained).slice(0, 8),
    [nodes],
  );
  return (
    <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 backdrop-blur-[16px]">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-[#eaf7ff]">Top movers</h2>
        <span className="font-mono text-[10px] text-[#5f8299]">30-day stars</span>
      </div>
      {movers.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-[#4d6f86]">No measured movement yet this cycle.</div>
      ) : (
        <ol className="flex list-none flex-col divide-y divide-[rgba(116,224,255,0.07)]">
          {movers.map((n, i) => (
            <li key={n.slug}>
              <button onClick={() => onPick(n.slug)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[rgba(116,224,255,0.04)]">
                <span className="w-4 flex-none font-mono text-[11px] text-[#5f8299]">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[#eaf7ff]">{n.name}</span>
                  <span className="block truncate font-mono text-[10.5px] text-[#5f8299]">{n.owner}</span>
                </span>
                <ActivityBars weeks={n.commitActivity} count={8} height={16} />
                <span className="w-12 flex-none text-right font-mono text-[12px] text-[#57e0a8]">+{formatStars(n.gained)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function OverviewView({
  nodes,
  clusters,
  onPick,
  onOpenCluster,
}: {
  nodes: ScopeNode[];
  clusters: ScopeCluster[];
  onPick: (slug: string) => void;
  onOpenCluster: (slug: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-sm rounded-xl border border-[rgba(116,224,255,0.16)] bg-[rgba(8,16,26,0.8)] px-6 py-5 text-center backdrop-blur-md">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#74e0ff]">nothing to plot</div>
          <div className="mt-2 text-sm text-[#93b4c9]">
            Every cluster is hidden, or the first sweep has not landed yet. Show a cluster to populate the overview.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-7 pb-14 pt-[22px]">
        <TrendQuadrant nodes={nodes} onPick={onPick} />
        <InsightsSection nodes={nodes} clusters={clusters} onPick={onPick} onOpenCluster={onOpenCluster} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <ClusterStrip clusters={clusters} nodes={nodes} onOpenCluster={onOpenCluster} />
          <TopMovers nodes={nodes} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
