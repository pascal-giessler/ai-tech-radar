"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLandscapeEvents } from "@/hooks/useLandscapeEvents";
import { LIVE, buildModel, clusterColor } from "@/lib/cinematic";
import type { LandscapeData } from "@/lib/types";

import { ClustersView } from "./ClustersView";
import { DetailPanel, FullDossier } from "./Dossier";
import { RadarCanvas } from "./RadarCanvas";
import { RecordsView, type SortKey } from "./RecordsView";

type View = "radar" | "records" | "clusters";

const VIEW_META: Record<View, [string, string]> = {
  radar: ["Radar", "Live momentum map of the open-source AI stack"],
  records: ["Records", "Full register of every tracked contact"],
  clusters: ["Clusters", "Curate categories and propose new ones"],
};

export function AppShell({ initial }: { initial: LandscapeData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("radar");
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [dossierSlug, setDossierSlug] = useState<string | null>(null);
  const [tilted, setTilted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/landscape");
      if (res.ok) setData(await res.json());
    } catch {
      /* keep last landscape */
    }
  }, []);
  useLandscapeEvents(useCallback(() => refetch(), [refetch]));
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        setSelectedSlug(null);
        setDossierSlug(null);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const model = useMemo(() => buildModel(data.tools, data.clusters), [data.tools, data.clusters]);
  const selectNode = model.nodes.find((n) => n.slug === selectedSlug) ?? null;
  const dossierNode = model.nodes.find((n) => n.slug === dossierSlug) ?? null;

  const scanTime = useMemo(() => {
    const d = new Date(data.generated_at);
    return d.getTime() > 0
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [data.generated_at]);

  const matchList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return model.nodes.filter((n) => n.hay.includes(q)).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [model.nodes, query]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => -d);
    else {
      setSortKey(k);
      setSortDir(k === "name" ? 1 : -1);
    }
  };

  const NAV: { key: View; label: string; icon: React.ReactNode }[] = [
    {
      key: "radar",
      label: "Radar",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.4" />
          <line x1="12" y1="12" x2="20" y2="6.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "records",
      label: "Records",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="9" y1="7" x2="20" y2="7" strokeLinecap="round" />
          <line x1="9" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="9" y1="17" x2="20" y2="17" strokeLinecap="round" />
          <circle cx="4.5" cy="7" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="17" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: "clusters",
      label: "Clusters",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7.5" cy="7.5" r="3.2" />
          <circle cx="16.5" cy="7.5" r="3.2" />
          <circle cx="7.5" cy="16.5" r="3.2" />
          <circle cx="16.5" cy="16.5" r="3.2" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="flex h-dvh w-full overflow-hidden"
      style={{ background: "radial-gradient(120% 95% at 50% 28%, #0a1626 0%, #060c16 55%, #03060c 100%)" }}
    >
      {/* ============ SIDEBAR ============ */}
      <aside
        className="flex flex-none flex-col overflow-hidden border-r border-[rgba(116,224,255,0.12)] bg-[rgba(7,14,24,0.72)] backdrop-blur-[22px] transition-[width] duration-300"
        style={{ width: collapsed ? 70 : 252 }}
      >
        <div className="flex h-16 flex-none items-center gap-3 border-b border-[rgba(116,224,255,0.1)] px-[18px]">
          <span className="relative h-[30px] w-[30px] flex-none">
            <span className="absolute inset-0 rounded-full border border-[rgba(116,224,255,0.4)] shadow-[0_0_12px_rgba(116,224,255,0.4),inset_0_0_8px_rgba(116,224,255,0.2)]" />
            <span className="absolute inset-2 rounded-full border border-[rgba(116,224,255,0.28)]" />
            <span className="absolute left-1/2 top-1/2 -ml-[2.5px] -mt-[2.5px] h-[5px] w-[5px] rounded-full bg-[#74e0ff] shadow-[0_0_12px_#74e0ff]" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-[1.15]">
              <span className="text-base font-medium tracking-[0.04em] text-[#eaf7ff]">AI&nbsp;RADAR</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#5f8299]">tech tracker</span>
            </span>
          )}
        </div>

        <nav className="flex flex-none flex-col gap-[3px] px-3 py-3.5">
          {NAV.map((n) => {
            const active = view === n.key;
            return (
              <button
                key={n.key}
                onClick={() => {
                  setView(n.key);
                  setDossierSlug(null);
                }}
                className="relative flex w-full items-center rounded-[11px] text-left text-sm transition-colors"
                style={{
                  gap: collapsed ? 0 : 13,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "12px 0" : "11px 13px",
                  background: active ? "rgba(116,224,255,0.1)" : "transparent",
                  color: active ? "#e2f3ff" : "#8aa6ba",
                  fontWeight: active ? 600 : 500,
                  boxShadow: active ? "inset 2.5px 0 0 #74e0ff, inset 0 0 26px rgba(116,224,255,0.1)" : "none",
                }}
              >
                {n.icon}
                {!collapsed && <span>{n.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed ? (
          <div className="min-h-0 flex-1 overflow-auto px-3.5 pb-3.5 pt-2">
            <div className="mx-1 mb-2.5 mt-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5f8299]">Categories</div>
            <ul className="flex list-none flex-col gap-px">
              {model.clusters.map((c) => {
                const active = isolated === c.slug;
                const dim = isolated && !active;
                const dot = clusterColor(c.hue, 0.78, 0.15);
                return (
                  <li key={c.slug}>
                    <button
                      onClick={() => setIsolated((s) => (s === c.slug ? null : c.slug))}
                      className="relative flex w-full items-center gap-2.5 rounded-lg px-[9px] py-[7px] text-left"
                      style={{ background: active ? "rgba(116,224,255,0.1)" : "transparent" }}
                    >
                      <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: dot, boxShadow: `0 0 8px ${clusterColor(c.hue, 0.78, 0.15, 0.7)}` }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: dim ? "#4d6f86" : "#c6deec" }}>
                        {c.label}
                      </span>
                      <span className="font-mono text-[11px] text-[#5f8299]">{c.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mx-1 mt-3.5 text-[11.5px] leading-[1.6] text-[#4d6f86]">
              Select a category to isolate its contacts on the radar.
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex-none border-t border-[rgba(116,224,255,0.1)] p-3">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1 pb-2.5 font-mono text-[10px] text-[#5f8299]">
              <span className="live-dot h-1.5 w-1.5 flex-none rounded-full" style={{ background: LIVE, boxShadow: `0 0 8px ${LIVE}` }} />
              <span>
                {data.tools.length} contacts · scanned {scanTime}
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-[9px] border border-[rgba(116,224,255,0.16)] bg-[rgba(116,224,255,0.04)] p-2 text-xs font-medium text-[#93b4c9]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
              <polyline points="15 6 9 12 15 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-[66px] flex-none items-center gap-5 border-b border-[rgba(116,224,255,0.1)] bg-[rgba(6,12,20,0.62)] px-6 backdrop-blur-[24px]">
          <div className="max-w-[30%] flex-none">
            <div className="text-base font-semibold tracking-[0.005em] text-[#eaf7ff]">{VIEW_META[view][0]}</div>
            <div className="mt-px truncate text-[11.5px] text-[#5f8299]">{VIEW_META[view][1]}</div>
          </div>

          <div className="relative mx-auto max-w-[460px] flex-1">
            <span className="absolute left-[13px] top-1/2 flex -translate-y-1/2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f8299" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matchList[0]) {
                  setSelectedSlug(matchList[0].slug);
                  setQuery("");
                }
              }}
              placeholder="Search the sky — tools, topics, owners"
              className="w-full rounded-[10px] border border-[rgba(116,224,255,0.16)] bg-[rgba(9,18,30,0.7)] py-[9px] pl-9 pr-10 text-[13.5px] text-[#e2f3ff]"
            />
            <span className="absolute right-[11px] top-1/2 -translate-y-1/2 rounded-[5px] border border-[rgba(116,224,255,0.16)] px-1.5 py-px font-mono text-[11px] text-[#5f8299]">
              /
            </span>
            {matchList.length > 0 && (
              <ul className="absolute inset-x-0 top-[46px] z-40 list-none rounded-xl border border-[rgba(116,224,255,0.16)] bg-[rgba(9,17,28,0.94)] p-[5px] shadow-[0_22px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(116,224,255,0.05)] backdrop-blur-[20px]">
                {matchList.map((m) => (
                  <li key={m.slug}>
                    <button
                      onClick={() => {
                        setSelectedSlug(m.slug);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-[11px] rounded-lg px-2.5 py-2 text-left text-[#e2f3ff] hover:bg-[rgba(116,224,255,0.08)]"
                    >
                      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: clusterColor(m.hue, 0.78, 0.15), boxShadow: `0 0 8px ${clusterColor(m.hue, 0.78, 0.15)}` }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {m.owner}/{m.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#5f8299]">{m.score}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-none items-center gap-3">
            {view === "radar" && (
              <div className="inline-flex items-center gap-0.5 rounded-[11px] border border-[rgba(116,224,255,0.14)] bg-[rgba(9,18,30,0.55)] p-[3px]">
                {[
                  { k: false, label: "Top-down" },
                  { k: true, label: "Perspective" },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setTilted(o.k)}
                    className="whitespace-nowrap rounded-lg px-[13px] py-1.5 text-[12.5px] font-medium transition-colors"
                    style={{
                      background: tilted === o.k ? "rgba(116,224,255,0.16)" : "transparent",
                      color: tilted === o.k ? "#e2f3ff" : "#7fa0b5",
                      boxShadow: tilted === o.k ? "0 0 16px rgba(116,224,255,0.18)" : "none",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(116,224,255,0.14)] bg-[rgba(9,18,30,0.5)] px-3 py-[7px] font-mono text-[10px] tracking-[0.08em] text-[#5f8299]">
              <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: LIVE, boxShadow: `0 0 8px ${LIVE}` }} />
              LIVE · {scanTime}
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          {view === "radar" && (
            <RadarCanvas model={model} query={query} isolated={isolated} selectedSlug={selectedSlug} tilted={tilted} onSelect={setSelectedSlug} />
          )}
          {view === "records" && (
            <RecordsView nodes={model.nodes} query={query} sortKey={sortKey} sortDir={sortDir} activeSlug={dossierSlug} onSort={onSort} onPick={setDossierSlug} />
          )}
          {view === "clusters" && <ClustersView nodes={model.nodes} clusters={model.clusters} />}

          {data.tools.length === 0 && view === "radar" && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
              <div className="rounded-xl border border-[rgba(116,224,255,0.16)] bg-[rgba(8,16,26,0.8)] px-6 py-5 text-center backdrop-blur-md">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#74e0ff]">acquiring contacts</div>
                <div className="mt-2 max-w-xs text-sm text-[#93b4c9]">The first sweep of the tool sky is in progress — contacts appear the moment it completes.</div>
              </div>
            </div>
          )}

          {selectNode && !dossierNode && (
            <DetailPanel
              node={selectNode}
              onClose={() => setSelectedSlug(null)}
              onOpenDossier={() => {
                setDossierSlug(selectNode.slug);
                setSelectedSlug(null);
              }}
            />
          )}
          {dossierNode && (
            <FullDossier node={dossierNode} nodes={model.nodes} onClose={() => setDossierSlug(null)} onPick={setDossierSlug} />
          )}
        </div>
      </section>
    </div>
  );
}
