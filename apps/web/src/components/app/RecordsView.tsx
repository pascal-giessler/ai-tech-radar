"use client";

import { useMemo } from "react";

import { clusterColor, formatStars, type ScopeNode } from "@/lib/cinematic";
import { filterNodes, type RecordFilters } from "@/lib/filters";

import { FilterBar, type ClusterOption } from "./FilterBar";
import { ActivityBars, RingPill } from "./signals";

export type SortKey = "name" | "stars" | "gained" | "score" | "issues" | "activity";

const KEYF: Record<SortKey, (n: ScopeNode) => string | number> = {
  name: (n) => n.name,
  stars: (n) => n.stars,
  gained: (n) => n.gained,
  score: (n) => n.score,
  issues: (n) => n.openIssues,
  activity: (n) => n.commitsRecent,
};

export function RecordsView({
  nodes,
  query,
  sortKey,
  sortDir,
  activeSlug,
  filters,
  onFilters,
  onSort,
  onPick,
}: {
  /** Already visibility-filtered; the record filters narrow further. */
  nodes: ScopeNode[];
  query: string;
  sortKey: SortKey;
  sortDir: number;
  activeSlug: string | null;
  filters: RecordFilters;
  onFilters: (next: RecordFilters) => void;
  onSort: (k: SortKey) => void;
  onPick: (slug: string) => void;
}) {
  const clusterOptions = useMemo<ClusterOption[]>(() => {
    const seen = new Map<string, ClusterOption>();
    for (const n of nodes) {
      if (!seen.has(n.clusterSlug)) seen.set(n.clusterSlug, { slug: n.clusterSlug, label: n.clusterLabel, hue: n.hue });
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);

  const langOptions = useMemo(
    () => [...new Set(nodes.map((n) => n.language).filter((l): l is string => !!l))].sort(),
    [nodes],
  );

  const rows = useMemo(() => {
    const filtered = filterNodes(nodes, filters, query);
    return filtered.sort((a, b) => {
      const va = KEYF[sortKey](a);
      const vb = KEYF[sortKey](b);
      return typeof va === "string" ? va.localeCompare(vb as string) * sortDir : ((va as number) - (vb as number)) * sortDir;
    });
  }, [nodes, filters, query, sortKey, sortDir]);

  const caret = (k: SortKey) => (sortKey === k ? (sortDir < 0 ? "↓" : "↑") : "");
  const th =
    "px-3 py-[13px] font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5f8299] border-b border-[rgba(116,224,255,0.12)] whitespace-nowrap";
  const sortable = `${th} cursor-pointer select-none transition-colors hover:text-[#93b4c9]`;

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto max-w-[1180px] px-7 pb-14 pt-[22px]">
        <div className="mb-4">
          <FilterBar
            filters={filters}
            onChange={onFilters}
            clusterOptions={clusterOptions}
            langOptions={langOptions}
            resultCount={rows.length}
            totalCount={nodes.length}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-[rgba(116,224,255,0.04)]">
                <th className={`${sortable} text-left pl-[18px]`} onClick={() => onSort("name")}>Contact {caret("name")}</th>
                <th className={`${th} text-left`}>Category</th>
                <th className={`${th} text-left`}>Ring</th>
                <th className={`${sortable} text-right`} onClick={() => onSort("stars")}>Stars {caret("stars")}</th>
                <th className={`${sortable} text-right`} onClick={() => onSort("gained")}>30-day {caret("gained")}</th>
                <th className={`${sortable} text-right`} onClick={() => onSort("issues")}>Issues {caret("issues")}</th>
                <th className={`${sortable} text-left`} onClick={() => onSort("activity")}>Commits/wk {caret("activity")}</th>
                <th className={`${sortable} text-left pr-[18px]`} onClick={() => onSort("score")}>Score {caret("score")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const td = "px-3 py-3 border-b border-[rgba(116,224,255,0.06)]";
                const catColor = clusterColor(n.hue, 0.78, 0.15);
                return (
                  <tr
                    key={n.slug}
                    onClick={() => onPick(n.slug)}
                    className="cursor-pointer transition-colors hover:bg-[rgba(116,224,255,0.06)]"
                    style={{ background: n.slug === activeSlug ? "rgba(116,224,255,0.08)" : "transparent" }}
                  >
                    <td className={`${td} pl-[18px]`}>
                      <div className="font-semibold text-[#eaf7ff]">{n.name}</div>
                      <div className="font-mono text-[11px] text-[#5f8299]">{n.owner}</div>
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] text-[#93b4c9]">
                        <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: catColor }} />
                        {n.clusterLabel}
                      </span>
                    </td>
                    <td className={td}><RingPill ring={n.ring} /></td>
                    <td className={`${td} text-right font-mono text-[12.5px] text-[#e2f3ff]`}>★ {formatStars(n.stars)}</td>
                    <td className={`${td} text-right font-mono text-[12.5px]`} style={{ color: n.gained > 0 ? "#57e0a8" : "#4d6f86" }}>
                      {n.gained > 0 ? "+" + formatStars(n.gained) : "—"}
                    </td>
                    <td className={`${td} text-right font-mono text-[12.5px] text-[#93b4c9]`}>{formatStars(n.openIssues)}</td>
                    <td className={td}><ActivityBars weeks={n.commitActivity} /></td>
                    <td className={`${td} pr-[18px]`}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-[5px] w-16 overflow-hidden rounded-[3px] bg-[rgba(116,224,255,0.1)]">
                          <div className="h-full rounded-[3px]" style={{ width: `${n.score}%`, background: catColor }} />
                        </div>
                        <span className="min-w-[22px] font-mono text-xs text-[#93b4c9]">{n.score}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#74e0ff]">no matches</div>
              <div className="max-w-xs text-sm text-[#93b4c9]">
                No contacts match the current filters. Loosen a filter or clear them to see the full register.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
