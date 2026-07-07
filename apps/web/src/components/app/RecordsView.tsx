"use client";

import { TIER_BG, TIER_COLOR, clusterColor, formatStars, type ScopeNode } from "@/lib/cinematic";

export type SortKey = "name" | "stars" | "gained" | "score";

const KEYF: Record<SortKey, (n: ScopeNode) => string | number> = {
  name: (n) => n.name,
  stars: (n) => n.stars,
  gained: (n) => n.gained,
  score: (n) => n.score,
};

export function RecordsView({
  nodes,
  query,
  sortKey,
  sortDir,
  activeSlug,
  onSort,
  onPick,
}: {
  nodes: ScopeNode[];
  query: string;
  sortKey: SortKey;
  sortDir: number;
  activeSlug: string | null;
  onSort: (k: SortKey) => void;
  onPick: (slug: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const rows = (q ? nodes.filter((n) => n.hay.includes(q)) : nodes.slice()).sort((a, b) => {
    const va = KEYF[sortKey](a);
    const vb = KEYF[sortKey](b);
    return typeof va === "string" ? va.localeCompare(vb as string) * sortDir : ((va as number) - (vb as number)) * sortDir;
  });
  const caret = (k: SortKey) => (sortKey === k ? (sortDir < 0 ? "↓" : "↑") : "");
  const th =
    "px-3 py-[13px] font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5f8299] border-b border-[rgba(116,224,255,0.12)]";

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto max-w-[1120px] px-7 pb-14 pt-[22px]">
        <div className="mb-3.5 flex items-baseline justify-between">
          <div className="font-mono text-[11px] tracking-[0.06em] text-[#5f8299]">{rows.length} records</div>
          <div className="font-mono text-[11px] text-[#4d6f86]">select a row for full dossier</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-[rgba(116,224,255,0.04)]">
                <th className={`${th} cursor-pointer text-left pl-[18px]`} onClick={() => onSort("name")}>
                  Contact {caret("name")}
                </th>
                <th className={`${th} text-left`}>Category</th>
                <th className={`${th} text-left`}>Momentum</th>
                <th className={`${th} cursor-pointer text-right`} onClick={() => onSort("stars")}>
                  Stars {caret("stars")}
                </th>
                <th className={`${th} cursor-pointer text-right`} onClick={() => onSort("gained")}>
                  30-day {caret("gained")}
                </th>
                <th className={`${th} cursor-pointer text-left pr-[18px]`} onClick={() => onSort("score")}>
                  Score {caret("score")}
                </th>
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
                      <span className="inline-flex items-center gap-2 text-[12.5px] text-[#93b4c9]">
                        <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: catColor, boxShadow: `0 0 8px ${catColor}` }} />
                        {n.clusterLabel}
                      </span>
                    </td>
                    <td className={td}>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]"
                        style={{ background: TIER_BG[n.tier], color: TIER_COLOR[n.tier] }}
                      >
                        <span className="h-[5px] w-[5px] rounded-full" style={{ background: TIER_COLOR[n.tier], boxShadow: `0 0 6px ${TIER_COLOR[n.tier]}` }} />
                        {n.tier}
                      </span>
                    </td>
                    <td className={`${td} text-right font-mono text-[12.5px] text-[#e2f3ff]`}>★ {formatStars(n.stars)}</td>
                    <td
                      className={`${td} text-right font-mono text-[12.5px]`}
                      style={{ color: n.gained > 0 ? "#57e0a8" : "#4d6f86" }}
                    >
                      {n.gained > 0 ? "+" + formatStars(n.gained) : "—"}
                    </td>
                    <td className={`${td} pr-[18px]`}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-[5px] w-16 overflow-hidden rounded-[3px] bg-[rgba(116,224,255,0.1)]">
                          <div className="h-full rounded-[3px]" style={{ width: `${n.score}%`, background: catColor, boxShadow: `0 0 8px ${catColor}` }} />
                        </div>
                        <span className="min-w-[22px] font-mono text-xs text-[#93b4c9]">{n.score}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
