"use client";

import { useMemo, useState } from "react";

import {
  RING_COLOR,
  RING_ORDER,
  formatStars,
  ringLabel,
  type ScopeCluster,
  type ScopeNode,
} from "@/lib/cinematic";
import { RING_EXPLAINER } from "@/lib/explain";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { Ring } from "@/lib/types";

import { InfoTip } from "./InfoTip";
import { RingPill } from "./signals";

const card =
  "rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-4 backdrop-blur-[16px]";

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** A named-tool row used across drill-downs and insight panels. */
function ToolRow({
  n,
  onPick,
  right,
}: {
  n: ScopeNode;
  onPick: (slug: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onPick(n.slug)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[rgba(116,224,255,0.06)]"
    >
      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: n.ring ? RING_COLOR[n.ring] : "#6b8aa2" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-[#eaf7ff]">{n.name}</span>
        <span className="block truncate font-mono text-[10px] text-[#5f8299]">{n.owner}</span>
      </span>
      {right}
    </button>
  );
}

// ---------------------------------------------------------------- Stat strip

type Metric = "tools" | "clusters" | "momentum" | "movers";

function Tile({
  value,
  label,
  tip,
  active,
  onClick,
}: {
  value: string;
  label: string;
  tip?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className="min-w-0 rounded-2xl border p-4 text-left backdrop-blur-[16px] transition-colors"
      style={{
        borderColor: active ? "rgba(116,224,255,0.45)" : "rgba(116,224,255,0.13)",
        background: active ? "rgba(116,224,255,0.08)" : "rgba(8,16,26,0.55)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[22px] leading-none text-[#eaf7ff]">{value}</span>
        <span className="font-mono text-[10px] text-[#5f8299]" style={{ transform: active ? "rotate(180deg)" : "none" }}>▾</span>
      </div>
      <div className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f8299]">
        {label} {tip && <InfoTip text={tip} />}
      </div>
    </button>
  );
}

/** Headline KPIs — each tile drills down to name the tools behind the number. */
export function StatStrip({
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
  const [open, setOpen] = useState<Metric | null>(null);
  const med = useMemo(() => median(nodes.map((n) => n.score)), [nodes]);
  const movers = useMemo(() => nodes.filter((n) => n.gained > 0).sort((a, b) => b.gained - a.gained), [nodes]);
  const toggle = (m: Metric) => setOpen((o) => (o === m ? null : m));

  const byScore = useMemo(() => [...nodes].sort((a, b) => b.score - a.score), [nodes]);
  const nearMedian = useMemo(
    () => [...nodes].sort((a, b) => Math.abs(a.score - med) - Math.abs(b.score - med)).slice(0, 8),
    [nodes, med],
  );
  const orderedClusters = useMemo(() => [...clusters].sort((a, b) => b.count - a.count), [clusters]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={String(nodes.length)} label="tools tracked" active={open === "tools"} onClick={() => toggle("tools")} />
        <Tile value={String(clusters.length)} label="clusters" active={open === "clusters"} onClick={() => toggle("clusters")} />
        <Tile
          value={String(med)}
          label="median momentum"
          tip="The middle momentum score across all visible tools — a pulse of how fast the area is moving."
          active={open === "momentum"}
          onClick={() => toggle("momentum")}
        />
        <Tile
          value={String(movers.length)}
          label="moving (30d)"
          tip="Tools that gained stars in the last 30 days."
          active={open === "movers"}
          onClick={() => toggle("movers")}
        />
      </div>

      {open && (
        <div className={`${card} mt-3`}>
          {open === "movers" && (
            <Drill title={`${movers.length} tools gained stars in the last 30 days`} empty="No measured movement this cycle yet.">
              {movers.slice(0, 12).map((n) => (
                <ToolRow key={n.slug} n={n} onPick={onPick} right={<span className="font-mono text-[11px] text-[#57e0a8]">+{formatStars(n.gained)}</span>} />
              ))}
            </Drill>
          )}
          {open === "momentum" && (
            <Drill title={`Tools around the median momentum (${med})`}>
              {nearMedian.map((n) => (
                <ToolRow key={n.slug} n={n} onPick={onPick} right={<span className="font-mono text-[11px] text-[#93b4c9]">{n.score}</span>} />
              ))}
            </Drill>
          )}
          {open === "tools" && (
            <Drill title={`Top tools by momentum · ${nodes.length} tracked`}>
              {byScore.slice(0, 12).map((n) => (
                <ToolRow key={n.slug} n={n} onPick={onPick} right={<span className="font-mono text-[11px] text-[#93b4c9]">{n.score}</span>} />
              ))}
            </Drill>
          )}
          {open === "clusters" && (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {orderedClusters.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => onOpenCluster(c.slug)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[rgba(116,224,255,0.06)]"
                >
                  <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: `oklch(0.78 0.15 ${c.hue})` }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#eaf7ff]">{c.label}</span>
                  <span className="font-mono text-[11px] text-[#5f8299]">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Drill({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#74e0ff]">{title}</div>
      {items.length === 0 && empty ? (
        <div className="px-2 py-1 font-mono text-[11px] text-[#4d6f86]">{empty}</div>
      ) : (
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">{children}</div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Insight panels

/** Stacked adoption-ring profile — how mature the tracked area is overall. */
function RingDistribution({ nodes }: { nodes: ScopeNode[] }) {
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
          counts[r] ? <div key={r} title={`${ringLabel(r === "unrated" ? null : r)}: ${counts[r]}`} style={{ width: `${(counts[r] / total) * 100}%`, background: color(r) }} /> : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {rings.map((r) =>
          counts[r] ? (
            <span key={r} className="flex items-center gap-1.5 font-mono text-[11px] text-[#93b4c9]">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: color(r) }} />
              {ringLabel(r === "unrated" ? null : r)} <span className="text-[#e2f3ff]">{counts[r]}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Top languages by tool count — what the ecosystem is built in. */
function LanguageMix({ nodes }: { nodes: ScopeNode[] }) {
  const top = useMemo(() => {
    const tally = new Map<string, number>();
    for (const n of nodes) if (n.language) tally.set(n.language, (tally.get(n.language) ?? 0) + 1);
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
                <span className="block h-full rounded-full bg-[#74e0ff]" style={{ width: `${(count / max) * 100}%`, opacity: 0.7 }} />
              </span>
              <span className="w-6 flex-none text-right font-mono text-[11px] text-[#5f8299]">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelList({
  title,
  tip,
  rows,
  empty,
  onPick,
  render,
}: {
  title: string;
  tip?: string;
  rows: ScopeNode[];
  empty: string;
  onPick: (slug: string) => void;
  render: (n: ScopeNode) => React.ReactNode;
}) {
  return (
    <div className={card}>
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-semibold text-[#eaf7ff]">{title}</h3>
        {tip && <InfoTip text={tip} />}
      </div>
      {rows.length === 0 ? (
        <div className="px-2 py-2 font-mono text-[11px] text-[#4d6f86]">{empty}</div>
      ) : (
        <div className="flex flex-col">
          {rows.map((n) => (
            <ToolRow key={n.slug} n={n} onPick={onPick} right={render(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Freshly-discovered tools, newest first. */
function NewEntrants({ nodes, onPick }: { nodes: ScopeNode[]; onPick: (slug: string) => void }) {
  const rows = useMemo(
    () => [...nodes].filter((n) => n.firstSeen).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)).slice(0, 8),
    [nodes],
  );
  return (
    <PanelList
      title="New entrants"
      tip="Tools most recently discovered and added to the radar."
      rows={rows}
      empty="No discovery timestamps yet."
      onPick={onPick}
      render={(n) => <RingPill ring={n.ring} />}
    />
  );
}

/** Repo health: heaviest open-issue backlogs. */
function RepoHealth({ nodes, onPick }: { nodes: ScopeNode[]; onPick: (slug: string) => void }) {
  const rows = useMemo(
    () => [...nodes].filter((n) => n.openIssues > 0).sort((a, b) => b.openIssues - a.openIssues).slice(0, 8),
    [nodes],
  );
  return (
    <PanelList
      title="Open-issue backlog"
      tip="Tools with the most open GitHub issues — busy or in demand, but also more to triage."
      rows={rows}
      empty="No issue data yet."
      onPick={onPick}
      render={(n) => <span className="font-mono text-[11px] text-[#e6b877]">{formatStars(n.openIssues)}</span>}
    />
  );
}

/** Cooling: proven tools now in the Hold ring (low momentum). */
function CoolingWatch({ nodes, onPick }: { nodes: ScopeNode[]; onPick: (slug: string) => void }) {
  const rows = useMemo(
    () => nodes.filter((n) => n.ring === "hold").sort((a, b) => b.stars - a.stars).slice(0, 8),
    [nodes],
  );
  return (
    <PanelList
      title="Cooling watch"
      tip="Proven tools whose momentum has dropped below the warm line — stable, but no longer accelerating."
      rows={rows}
      empty="Nothing is cooling right now."
      onPick={onPick}
      render={(n) => <span className="font-mono text-[11px] text-[#93b4c9]">★ {formatStars(n.stars)}</span>}
    />
  );
}

// ------------------------------------------------------------ Section wrapper

interface PanelDef {
  key: string;
  label: string;
  render: (nodes: ScopeNode[], onPick: (slug: string) => void) => React.ReactNode;
}

const PANELS: PanelDef[] = [
  { key: "adoption", label: "Adoption profile", render: (n) => <RingDistribution nodes={n} /> },
  { key: "languages", label: "Built with", render: (n) => <LanguageMix nodes={n} /> },
  { key: "entrants", label: "New entrants", render: (n, p) => <NewEntrants nodes={n} onPick={p} /> },
  { key: "health", label: "Open-issue backlog", render: (n, p) => <RepoHealth nodes={n} onPick={p} /> },
  { key: "cooling", label: "Cooling watch", render: (n, p) => <CoolingWatch nodes={n} onPick={p} /> },
];

const DEFAULT_VISIBLE: Record<string, boolean> = {
  adoption: true,
  languages: true,
  entrants: true,
  health: true,
  cooling: false,
};

/** KPI strip + a customisable grid of insight panels the user can show/hide. */
export function InsightsSection({
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
  const [visible, setVisible] = usePersistentState<Record<string, boolean>>(
    "airadar.insight-panels.v1",
    DEFAULT_VISIBLE,
  );
  const isOn = (k: string) => visible[k] ?? DEFAULT_VISIBLE[k] ?? false;
  const shown = PANELS.filter((p) => isOn(p.key));

  return (
    <div className="flex flex-col gap-4">
      <StatStrip nodes={nodes} clusters={clusters} onPick={onPick} onOpenCluster={onOpenCluster} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f8299]">insights</span>
        {PANELS.map((p) => {
          const on = isOn(p.key);
          return (
            <button
              key={p.key}
              onClick={() => setVisible({ ...visible, [p.key]: !on })}
              aria-pressed={on}
              className="rounded-full border px-2.5 py-[5px] text-[11.5px] transition-colors"
              style={{
                borderColor: on ? "rgba(116,224,255,0.4)" : "rgba(116,224,255,0.14)",
                background: on ? "rgba(116,224,255,0.1)" : "transparent",
                color: on ? "#e2f3ff" : "#7fa0b5",
              }}
            >
              {on ? "✓ " : "+ "}
              {p.label}
            </button>
          );
        })}
      </div>

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((p) => (
            <div key={p.key}>{p.render(nodes, onPick)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
