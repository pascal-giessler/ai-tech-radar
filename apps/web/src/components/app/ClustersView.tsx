"use client";

import { useMemo } from "react";

import type { SettingsController } from "@/hooks/useSettings";
import type { ClusterVisibility } from "@/hooks/useClusterVisibility";
import {
  RING_COLOR,
  RING_ORDER,
  TIER_COLOR,
  cineTier,
  clusterColor,
  ringLabel,
  type ScopeCluster,
  type ScopeNode,
} from "@/lib/cinematic";
import type { Ring } from "@/lib/types";

import { ClusterExplainer } from "./ClusterExplainer";
import { SettingsPanel } from "./SettingsPanel";
import { EyeToggle } from "./visibility";

function RingMix({ members }: { members: ScopeNode[] }) {
  const counts = new Map<Ring | "unrated", number>();
  for (const n of members) {
    const key = n.ring ?? "unrated";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = members.length || 1;
  const segs: { key: Ring | "unrated"; color: string; n: number }[] = [
    ...RING_ORDER.map((r) => ({ key: r as Ring | "unrated", color: RING_COLOR[r], n: counts.get(r) ?? 0 })),
    { key: "unrated" as const, color: "rgba(107,138,162,0.5)", n: counts.get("unrated") ?? 0 },
  ].filter((s) => s.n > 0);

  return (
    <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-[rgba(116,224,255,0.08)]">
      {segs.map((s) => (
        <span key={s.key} title={`${s.key}: ${s.n}`} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

function ProfileCard({
  cluster,
  members,
  hidden,
  onToggle,
  onSolo,
  onPick,
}: {
  cluster: ScopeCluster;
  members: ScopeNode[];
  hidden: boolean;
  onToggle: () => void;
  onSolo: () => void;
  onPick: (slug: string) => void;
}) {
  const avg = members.length ? Math.round(members.reduce((a, n) => a + n.score, 0) / members.length) : 0;
  const tier = cineTier(avg);
  const top = [...members].sort((a, b) => b.score - a.score).slice(0, 3);
  const dot = clusterColor(cluster.hue, 0.78, 0.15);

  return (
    <div
      className="rounded-[16px] border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-[18px] shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-[14px] transition-opacity"
      style={{ opacity: hidden ? 0.45 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-[12px] w-[12px] flex-none rounded-[3px]" style={{ background: dot }} />
          <span className="truncate text-[14px] font-semibold text-[#eaf7ff]">{cluster.label}</span>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <span className="font-mono text-[11px] text-[#5f8299]">{members.length}</span>
          <button
            onClick={onSolo}
            title="Show only this cluster"
            className="rounded-md border border-[rgba(116,224,255,0.16)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#93b4c9] transition-colors hover:text-[#e2f3ff]"
          >
            solo
          </button>
          <EyeToggle hidden={hidden} onToggle={onToggle} />
        </div>
      </div>

      {cluster.description && (
        <p className="mt-2.5 text-[12px] leading-[1.5] text-[#8aa6ba]">{cluster.description}</p>
      )}

      {cluster.keywords.length > 0 && (
        <ul className="mt-3 flex list-none flex-wrap gap-1.5">
          {cluster.keywords.slice(0, 6).map((k) => (
            <li key={k} className="rounded-full border border-[rgba(116,224,255,0.16)] px-2 py-[2px] font-mono text-[10px] text-[#93b4c9]">
              {k}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-[#5f8299]">
          <span>ring mix</span>
          <span style={{ color: TIER_COLOR[tier] }}>
            avg {avg} · {tier}
          </span>
        </div>
        <RingMix members={members} />
      </div>

      <div className="mt-3.5 border-t border-[rgba(116,224,255,0.09)] pt-2.5">
        <ul className="flex list-none flex-col gap-0.5">
          {top.map((n) => (
            <li key={n.slug}>
              <button
                onClick={() => onPick(n.slug)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(116,224,255,0.06)]"
              >
                <span className="min-w-0 truncate text-[12px] text-[#c6deec]">{n.owner}/{n.name}</span>
                <span className="flex flex-none items-center gap-2">
                  <span className="font-mono text-[10px]" style={{ color: n.ring ? RING_COLOR[n.ring] : "#6b8aa2" }}>
                    {ringLabel(n.ring)}
                  </span>
                  <span className="font-mono text-[11px] text-[#5f8299]">{n.score}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ClustersView({
  nodes,
  clusters,
  visibility,
  settings,
  toolCount,
  onPick,
}: {
  /** All nodes, unfiltered — hidden clusters still show here (dimmed) so they can be restored. */
  nodes: ScopeNode[];
  clusters: ScopeCluster[];
  visibility: ClusterVisibility;
  settings: SettingsController;
  toolCount: number;
  onPick: (slug: string) => void;
}) {
  const allSlugs = useMemo(() => clusters.map((c) => c.slug), [clusters]);
  const membersBySlug = useMemo(() => {
    const m = new Map<string, ScopeNode[]>();
    for (const n of nodes) {
      const arr = m.get(n.clusterSlug) ?? [];
      arr.push(n);
      m.set(n.clusterSlug, arr);
    }
    return m;
  }, [nodes]);

  const ordered = useMemo(() => [...clusters].sort((a, b) => b.count - a.count), [clusters]);

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-7 pb-14 pt-[22px]">
        <ClusterExplainer settings={settings.settings} toolCount={toolCount} clusterCount={clusters.length} />

        <SettingsPanel controller={settings} />

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#eaf7ff]">Cluster profiles</h3>
            {visibility.hiddenCount > 0 && (
              <button onClick={visibility.showAll} className="font-mono text-[11px] text-[#74e0ff] transition-colors hover:text-[#a6ecff]">
                show all ({visibility.hiddenCount} hidden)
              </button>
            )}
          </div>
          {ordered.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] px-6 py-12 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#74e0ff]">no clusters yet</div>
              <div className="mt-2 text-sm text-[#93b4c9]">
                The map needs enough tracked tools before territories emerge. Lower the minimum in Configuration to
                cluster sooner.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
              {ordered.map((c) => (
                <ProfileCard
                  key={c.slug}
                  cluster={c}
                  members={membersBySlug.get(c.slug) ?? []}
                  hidden={!visibility.isVisible(c.slug)}
                  onToggle={() => visibility.toggle(c.slug)}
                  onSolo={() => visibility.solo(c.slug, allSlugs)}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
