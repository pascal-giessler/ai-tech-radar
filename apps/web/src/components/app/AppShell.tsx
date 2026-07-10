"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useClusterVisibility } from "@/hooks/useClusterVisibility";
import { useLandscapeEvents } from "@/hooks/useLandscapeEvents";
import { useSettings } from "@/hooks/useSettings";
import { LIVE, buildModel, clusterColor, type ScopeModel } from "@/lib/cinematic";
import { EMPTY_FILTERS, type RecordFilters } from "@/lib/filters";
import type { LandscapeData } from "@/lib/types";
import { usePersistentState } from "@/hooks/usePersistentState";

import { AreaSelector } from "./AreaSelector";
import { AreaSwitchOverlay } from "./AreaSwitchOverlay";
import { ClustersView } from "./ClustersView";
import { DetailPanel, FullDossier } from "./Dossier";
import { OverviewView } from "./OverviewView";
import { RadarCanvas } from "./RadarCanvas";
import { RecordsView, type SortKey } from "./RecordsView";
import { EyeToggle } from "./visibility";

type View = "overview" | "radar" | "records" | "clusters";

const VIEW_META: Record<View, [string, string]> = {
  overview: ["Overview", "The tracked domain at a glance — momentum, maturity and movement"],
  radar: ["Radar", "Live momentum map of the tracked domain"],
  records: ["Records", "Full register of every tracked contact — filter and sort"],
  clusters: ["Clusters", "How the categories form, how to tune them, and what's in each"],
};

const NAV_ICON: Record<View, React.ReactNode> = {
  overview: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="4" y1="20" x2="20" y2="20" strokeLinecap="round" />
      <line x1="4" y1="20" x2="4" y2="4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  radar: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.4" />
      <line x1="12" y1="12" x2="20" y2="6.5" strokeLinecap="round" />
    </svg>
  ),
  records: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="9" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <line x1="9" y1="12" x2="20" y2="12" strokeLinecap="round" />
      <line x1="9" y1="17" x2="20" y2="17" strokeLinecap="round" />
      <circle cx="4.5" cy="7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  clusters: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7.5" cy="7.5" r="3.2" />
      <circle cx="16.5" cy="7.5" r="3.2" />
      <circle cx="7.5" cy="16.5" r="3.2" />
      <circle cx="16.5" cy="16.5" r="3.2" />
    </svg>
  ),
};

const NAV_ORDER: View[] = ["overview", "radar", "records", "clusters"];

export function AppShell({ initial }: { initial: LandscapeData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [dossierSlug, setDossierSlug] = useState<string | null>(null);
  const [tilted, setTilted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState(-1);
  const [filters, setFilters] = usePersistentState<RecordFilters>("airadar.record-filters.v1", EMPTY_FILTERS);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibility = useClusterVisibility();
  const settings = useSettings();

  // Area-switch loading state. A switch (from the header selector or the config
  // panel) leaves the old landscape stale for seconds while the worker re-ingests
  // and re-clusters; show a loading overlay until the new landscape streams in.
  const [pendingArea, setPendingArea] = useState<string | null>(null);
  const prevAreaRef = useRef<string | null>(null);
  const switchGenAtRef = useRef<string | null>(null);

  useEffect(() => {
    const area = settings.settings?.area_preset;
    if (!area) return;
    if (prevAreaRef.current === null) {
      prevAreaRef.current = area; // first settings load — not a switch
      return;
    }
    if (area !== prevAreaRef.current) {
      prevAreaRef.current = area;
      switchGenAtRef.current = data.generated_at; // the landscape we're leaving
      const title = settings.settings?.presets.find((p) => p.slug === area)?.title ?? area;
      setPendingArea(title);
    }
  }, [settings.settings, data.generated_at]);

  // Clear the overlay once a freshly-recomputed landscape (new timestamp) lands.
  useEffect(() => {
    if (pendingArea && switchGenAtRef.current && data.generated_at !== switchGenAtRef.current) {
      setPendingArea(null);
    }
  }, [data.generated_at, pendingArea]);

  // Safety net: never trap the user if a scan stalls or fails.
  useEffect(() => {
    if (!pendingArea) return;
    const t = setTimeout(() => setPendingArea(null), 90_000);
    return () => clearTimeout(t);
  }, [pendingArea]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/landscape");
      if (res.ok) setData(await res.json());
    } catch {
      /* keep last landscape */
    }
  }, []);
  useLandscapeEvents(
    useCallback(() => {
      refetch();
      settings.reload();
    }, [refetch, settings]),
  );
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

  // Cluster hide/unhide is global: everything except the Clusters view (which shows
  // hidden clusters dimmed so they can be restored) sees only the visible set.
  const visibleModel = useMemo<ScopeModel>(
    () => ({
      nodes: model.nodes.filter((n) => visibility.isVisible(n.clusterSlug)),
      clusters: model.clusters.filter((c) => visibility.isVisible(c.slug)),
      maxStars: model.maxStars,
    }),
    [model, visibility],
  );

  const selectNode = visibleModel.nodes.find((n) => n.slug === selectedSlug) ?? null;
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
    return visibleModel.nodes.filter((n) => n.hay.includes(q)).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [visibleModel.nodes, query]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => -d);
    else {
      setSortKey(k);
      setSortDir(k === "name" ? 1 : -1);
    }
  };

  const allSlugs = useMemo(() => model.clusters.map((c) => c.slug), [model.clusters]);
  const toggleVisibility = useCallback(
    (slug: string) => {
      visibility.toggle(slug);
      setIsolated((iso) => (iso === slug ? null : iso));
    },
    [visibility],
  );

  const openClusterInRecords = useCallback(
    (slug: string) => {
      setFilters({ ...EMPTY_FILTERS, clusters: [slug] });
      setView("records");
    },
    [setFilters],
  );

  return (
    <div
      className="flex h-dvh w-full overflow-hidden"
      style={{ background: "radial-gradient(120% 95% at 50% 28%, #0a1626 0%, #060c16 55%, #03060c 100%)" }}
    >
      {/* mobile drawer backdrop */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] md:hidden" onClick={() => setMobileNav(false)} />
      )}

      {/* ============ SIDEBAR ============ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-none flex-col overflow-hidden border-r border-[rgba(116,224,255,0.12)] bg-[rgba(7,14,24,0.92)] backdrop-blur-[22px] transition-[width,transform] duration-300 md:static md:z-auto md:translate-x-0 md:bg-[rgba(7,14,24,0.72)] ${
          mobileNav ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[70px]" : "md:w-[252px]"}`}
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
          {NAV_ORDER.map((key) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setView(key);
                  setDossierSlug(null);
                  setMobileNav(false);
                }}
                className="relative flex w-full items-center rounded-[11px] text-left text-sm transition-colors"
                style={{
                  gap: collapsed ? 0 : 13,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "12px 0" : "11px 13px",
                  background: active ? "rgba(116,224,255,0.1)" : "transparent",
                  color: active ? "#e2f3ff" : "#8aa6ba",
                  fontWeight: active ? 600 : 500,
                  boxShadow: active ? "inset 0 0 26px rgba(116,224,255,0.1)" : "none",
                }}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-[#74e0ff]" />}
                {NAV_ICON[key]}
                {!collapsed && <span>{VIEW_META[key][0]}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed ? (
          <div className="min-h-0 flex-1 overflow-auto px-3.5 pb-3.5 pt-2">
            <div className="mx-1 mb-2.5 mt-2 flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5f8299]">Categories</span>
              <div className="flex items-center gap-2 font-mono text-[9.5px]">
                {visibility.hiddenCount > 0 && (
                  <button onClick={visibility.showAll} className="text-[#74e0ff] transition-colors hover:text-[#a6ecff]">
                    show all
                  </button>
                )}
                {model.clusters.length > 0 && visibility.hiddenCount < model.clusters.length && (
                  <button onClick={() => visibility.hideAll(allSlugs)} className="text-[#5f8299] transition-colors hover:text-[#93b4c9]">
                    hide all
                  </button>
                )}
              </div>
            </div>
            <ul className="flex list-none flex-col gap-px">
              {model.clusters.map((c) => {
                const hidden = !visibility.isVisible(c.slug);
                const active = isolated === c.slug;
                const dim = (isolated && !active) || hidden;
                const dot = clusterColor(c.hue, 0.78, 0.15);
                return (
                  <li key={c.slug} className="flex items-center gap-1">
                    <button
                      onClick={() => !hidden && setIsolated((s) => (s === c.slug ? null : c.slug))}
                      disabled={hidden}
                      title={hidden ? "Cluster hidden" : "Isolate on radar"}
                      className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-[9px] py-[7px] text-left disabled:cursor-not-allowed"
                      style={{ background: active ? "rgba(116,224,255,0.1)" : "transparent" }}
                    >
                      <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: dot, opacity: dim ? 0.4 : 1 }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: dim ? "#4d6f86" : "#c6deec" }}>
                        {c.label}
                      </span>
                      <span className="font-mono text-[11px] text-[#5f8299]">{c.count}</span>
                    </button>
                    <EyeToggle hidden={hidden} onToggle={() => toggleVisibility(c.slug)} />
                  </li>
                );
              })}
            </ul>
            <div className="mx-1 mt-3.5 text-[11.5px] leading-[1.6] text-[#4d6f86]">
              Click a category to isolate it on the radar. Use the eye to hide it everywhere.
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
        <header className="z-20 flex h-[66px] flex-none items-center gap-3 border-b border-[rgba(116,224,255,0.1)] bg-[rgba(6,12,20,0.62)] px-4 backdrop-blur-[24px] md:gap-5 md:px-6">
          <button
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[rgba(116,224,255,0.16)] text-[#93b4c9] md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="hidden max-w-[32%] flex-none sm:block">
            <div className="text-base font-semibold tracking-[0.005em] text-[#eaf7ff]">{VIEW_META[view][0]}</div>
            <div className="mt-px hidden truncate text-[11.5px] text-[#5f8299] md:block">{VIEW_META[view][1]}</div>
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
                      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: clusterColor(m.hue, 0.78, 0.15) }} />
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

          <div className="flex flex-none items-center gap-2 md:gap-3">
            {view === "radar" && (
              <div className="hidden items-center gap-0.5 rounded-[11px] border border-[rgba(116,224,255,0.14)] bg-[rgba(9,18,30,0.55)] p-[3px] sm:inline-flex">
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
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <AreaSelector controller={settings} />
            <div className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(116,224,255,0.14)] bg-[rgba(9,18,30,0.5)] px-3 py-[7px] font-mono text-[10px] tracking-[0.08em] text-[#5f8299] sm:inline-flex">
              <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: LIVE, boxShadow: `0 0 8px ${LIVE}` }} />
              LIVE · {scanTime}
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          {pendingArea && <AreaSwitchOverlay area={pendingArea} />}
          {view === "overview" && (
            <OverviewView nodes={visibleModel.nodes} clusters={visibleModel.clusters} onPick={setDossierSlug} onOpenCluster={openClusterInRecords} />
          )}
          {view === "radar" && (
            <RadarCanvas model={visibleModel} query={query} isolated={isolated} selectedSlug={selectedSlug} tilted={tilted} onSelect={setSelectedSlug} />
          )}
          {view === "records" && (
            <RecordsView
              nodes={visibleModel.nodes}
              query={query}
              sortKey={sortKey}
              sortDir={sortDir}
              activeSlug={dossierSlug}
              filters={filters}
              onFilters={setFilters}
              onSort={onSort}
              onPick={setDossierSlug}
            />
          )}
          {view === "clusters" && (
            <ClustersView
              nodes={model.nodes}
              clusters={model.clusters}
              visibility={visibility}
              settings={settings}
              toolCount={data.tools.length}
              onPick={setDossierSlug}
            />
          )}

          {data.tools.length === 0 && (view === "radar" || view === "overview") && (
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
