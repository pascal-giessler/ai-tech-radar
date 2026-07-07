"use client";

import { useMemo } from "react";

import { clusterHue } from "@/lib/format";
import { RINGS, ringMeta, ringRadius } from "@/lib/rings";
import type { Cluster, Ring, Tool } from "@/lib/types";

const SIZE = 760;
const CENTER = SIZE / 2;
const MAX_R = CENTER - 60;

function hashAngle(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return (h % 1000) / 1000; // 0..1
}

/**
 * The classic technology-radar view: angle encodes the semantic cluster (sector),
 * radius encodes the adoption ring (Adopt innermost → Hold outermost). Both
 * dimensions readable at a glance — the thing a 3D galaxy can't show flat.
 */
export function RadarDial({
  tools,
  clusters,
  activeRings,
  selectedSlug,
  onSelect,
}: {
  tools: Tool[];
  clusters: Cluster[];
  activeRings: Set<Ring>;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const sectors = useMemo(() => {
    const withMembers = clusters.filter((c) => tools.some((t) => t.cluster_id === c.id));
    const step = (Math.PI * 2) / Math.max(withMembers.length, 1);
    const angleById = new Map<number, number>();
    withMembers.forEach((c, i) => angleById.set(c.id, i * step));
    return { angleById, step, count: withMembers.length };
  }, [clusters, tools]);

  const points = useMemo(() => {
    return tools
      .filter((t) => t.ring && t.cluster_id !== null && sectors.angleById.has(t.cluster_id))
      .map((t) => {
        const base = sectors.angleById.get(t.cluster_id!)!;
        const jitter = (hashAngle(t.slug) - 0.5) * sectors.step * 0.82;
        const angle = base + jitter - Math.PI / 2; // 12 o'clock start
        const r = ringRadius(t.ring as Ring) * MAX_R;
        return {
          tool: t,
          x: CENTER + Math.cos(angle) * r,
          y: CENTER + Math.sin(angle) * r,
          hue: clusterHue(t.cluster_id!),
        };
      });
  }, [tools, sectors]);

  const bandEdges = RINGS.map((_, i) => ((i + 1) / RINGS.length) * MAX_R);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block h-full max-h-[86vh] w-auto"
      role="img"
      aria-label="Technology radar: adoption rings by semantic cluster"
    >
      {/* ring bands */}
      {bandEdges.map((r, i) => (
        <circle
          key={i}
          cx={CENTER}
          cy={CENTER}
          r={r}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ))}
      {/* ring labels along the 12 o'clock axis */}
      {RINGS.map((ring) => {
        const r = ringRadius(ring.slug) * MAX_R;
        const dim = activeRings.size > 0 && !activeRings.has(ring.slug);
        return (
          <text
            key={ring.slug}
            x={CENTER}
            y={CENTER - r + 4}
            textAnchor="middle"
            className="font-mono"
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fill: ring.color,
              opacity: dim ? 0.25 : 0.9,
            }}
          >
            {ring.label}
          </text>
        );
      })}
      {/* sector dividers */}
      {sectors.count > 1 &&
        Array.from({ length: sectors.count }).map((_, i) => {
          const a = i * sectors.step - Math.PI / 2 - sectors.step / 2;
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + Math.cos(a) * MAX_R}
              y2={CENTER + Math.sin(a) * MAX_R}
              stroke="var(--hairline)"
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}
      {/* tool blips */}
      {points.map(({ tool, x, y, hue }) => {
        const dim = activeRings.size > 0 && !activeRings.has(tool.ring as Ring);
        const selected = tool.slug === selectedSlug;
        const rr = 4 + (tool.trend_score / 100) * 6;
        return (
          <g
            key={tool.slug}
            transform={`translate(${x} ${y})`}
            onClick={() => onSelect(tool.slug)}
            style={{ cursor: "pointer", opacity: dim ? 0.12 : 1 }}
          >
            <circle
              r={selected ? rr + 4 : rr}
              fill={`hsl(${hue} 70% 60%)`}
              stroke={selected ? "var(--phosphor)" : "transparent"}
              strokeWidth={2}
            />
            <title>
              {tool.owner}/{tool.name} — {tool.ring}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
