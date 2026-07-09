"use client";

import { useState } from "react";

import { RING_COLOR, TIER_COLOR, ringLabel, type CineTier } from "@/lib/cinematic";
import { activeFilterCount, toggleValue, type RecordFilters } from "@/lib/filters";
import type { Ring } from "@/lib/types";

const RINGS: Ring[] = ["adopt", "trial", "assess", "hold"];
const TIERS: CineTier[] = ["surging", "rising", "steady", "watch"];

export interface ClusterOption {
  slug: string;
  label: string;
  hue: number;
}

function Dot({ color }: { color: string }) {
  return <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: color }} />;
}

/** A dropdown of checkboxes for one multi-select dimension. */
function Menu({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[9px] border px-3 py-[7px] text-[12.5px] transition-colors"
        style={{
          borderColor: count ? "rgba(116,224,255,0.4)" : "rgba(116,224,255,0.16)",
          background: count ? "rgba(116,224,255,0.09)" : "rgba(9,18,30,0.55)",
          color: count ? "#e2f3ff" : "#93b4c9",
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-[#74e0ff] px-[6px] font-mono text-[10px] font-semibold text-[#03121a]">
            {count}
          </span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s ease" }}>
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[42px] z-50 max-h-[300px] min-w-[190px] overflow-auto rounded-xl border border-[rgba(116,224,255,0.18)] bg-[rgba(9,17,28,0.96)] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.6)] backdrop-blur-[20px]">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-[rgba(116,224,255,0.08)]"
      style={{ color: active ? "#e2f3ff" : "#93b4c9" }}
    >
      <span
        className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4px] border"
        style={{
          borderColor: active ? "#74e0ff" : "rgba(116,224,255,0.3)",
          background: active ? "#74e0ff" : "transparent",
        }}
      >
        {active && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#03121a" strokeWidth="3.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  clusterOptions,
  langOptions,
  resultCount,
  totalCount,
}: {
  filters: RecordFilters;
  onChange: (next: RecordFilters) => void;
  clusterOptions: ClusterOption[];
  langOptions: string[];
  resultCount: number;
  totalCount: number;
}) {
  const active = activeFilterCount(filters);
  const set = (patch: Partial<RecordFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Menu label="Cluster" count={filters.clusters.length}>
        {clusterOptions.length === 0 && <div className="px-2.5 py-2 text-[12px] text-[#4d6f86]">No clusters yet</div>}
        {clusterOptions.map((c) => (
          <Row key={c.slug} active={filters.clusters.includes(c.slug)} onClick={() => set({ clusters: toggleValue(filters.clusters, c.slug) })}>
            <Dot color={`oklch(0.78 0.15 ${c.hue})`} />
            <span className="truncate">{c.label}</span>
          </Row>
        ))}
      </Menu>

      <Menu label="Ring" count={filters.rings.length}>
        {RINGS.map((r) => (
          <Row key={r} active={filters.rings.includes(r)} onClick={() => set({ rings: toggleValue(filters.rings, r) })}>
            <Dot color={RING_COLOR[r]} />
            {ringLabel(r)}
          </Row>
        ))}
      </Menu>

      <Menu label="Momentum" count={filters.tiers.length}>
        {TIERS.map((t) => (
          <Row key={t} active={filters.tiers.includes(t)} onClick={() => set({ tiers: toggleValue(filters.tiers, t) })}>
            <Dot color={TIER_COLOR[t]} />
            <span className="capitalize">{t}</span>
          </Row>
        ))}
      </Menu>

      <Menu label="Language" count={filters.langs.length}>
        {langOptions.length === 0 && <div className="px-2.5 py-2 text-[12px] text-[#4d6f86]">No languages</div>}
        {langOptions.map((l) => (
          <Row key={l} active={filters.langs.includes(l)} onClick={() => set({ langs: toggleValue(filters.langs, l) })}>
            {l}
          </Row>
        ))}
      </Menu>

      <label className="flex items-center gap-2.5 rounded-[9px] border border-[rgba(116,224,255,0.16)] bg-[rgba(9,18,30,0.55)] px-3 py-[6px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f8299]">min score</span>
        <input
          type="range"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(e) => set({ minScore: Number(e.target.value) })}
          className="h-1 w-24 cursor-pointer accent-[#74e0ff]"
          aria-label="Minimum momentum score"
        />
        <span className="w-6 font-mono text-[12px] text-[#e2f3ff]">{filters.minScore}</span>
      </label>

      {active > 0 && (
        <button
          onClick={() => onChange({ clusters: [], rings: [], tiers: [], langs: [], minScore: 0 })}
          className="rounded-[9px] border border-[rgba(116,224,255,0.16)] px-3 py-[7px] text-[12px] text-[#93b4c9] transition-colors hover:text-[#e2f3ff]"
        >
          Clear all
        </button>
      )}

      <div className="ml-auto font-mono text-[11px] text-[#5f8299]">
        <span className="text-[#e2f3ff]">{resultCount}</span> / {totalCount}
      </div>
    </div>
  );
}
