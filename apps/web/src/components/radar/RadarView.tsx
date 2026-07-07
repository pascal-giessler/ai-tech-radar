"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLandscapeEvents } from "@/hooks/useLandscapeEvents";
import type { LandscapeData, Ring, Tool } from "@/lib/types";

import { LiveStatus } from "./LiveStatus";
import { RadarDial } from "./RadarDial";
import { RingLegend, ViewToggle, type ViewMode } from "./RadarControls";
import { SearchOverlay } from "./SearchOverlay";
import { ToolPanel } from "./ToolPanel";

const RadarScene = dynamic(() => import("./RadarScene").then((m) => m.RadarScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs tracking-[0.3em] text-muted uppercase">
      calibrating instruments…
    </div>
  ),
});

export function RadarView({ initial }: { initial: LandscapeData }) {
  const [data, setData] = useState(initial);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("galaxy");
  const [activeRings, setActiveRings] = useState<Set<Ring>>(new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleRing = useCallback((ring: Ring) => {
    setActiveRings((prev) => {
      const next = new Set(prev);
      if (next.has(ring)) next.delete(ring);
      else next.add(ring);
      return next;
    });
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/landscape");
      if (res.ok) setData(await res.json());
    } catch {
      // keep showing the last landscape; the next event will retry
    }
  }, []);

  useLandscapeEvents(
    useCallback(
      (event) => {
        refetch();
        setFlash(`sweep complete — ${event.tool_count} tools on the radar`);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 5000);
      },
      [refetch],
    ),
  );

  // The SSR payload can be a stale ISR snapshot (or the pre-first-scan fallback);
  // sync with the live API as soon as the client boots.
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Nudge the WebGL canvas to paint its first frame without waiting for a pointer
  // event (R3F sizes on the first ResizeObserver tick).
  useEffect(() => {
    if (view !== "galaxy") return;
    const id = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(id);
  }, [view, data.tools.length]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const selected: Tool | null = useMemo(
    () => data.tools.find((t) => t.slug === selectedSlug) ?? null,
    [data.tools, selectedSlug],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {view === "galaxy" ? (
        <RadarScene
          tools={data.tools}
          clusters={data.clusters}
          activeRings={activeRings}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 pt-16">
          <RadarDial
            tools={data.tools}
            clusters={data.clusters}
            activeRings={activeRings}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>
      )}

      <SearchOverlay tools={data.tools} onSelect={setSelectedSlug} />
      <ToolPanel tool={selected} onClose={() => setSelectedSlug(null)} />

      {/* controls: view toggle + ring legend/filter */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex flex-col items-center gap-3 px-4">
        <div className="pointer-events-auto">
          <RingLegend tools={data.tools} activeRings={activeRings} onToggle={toggleRing} />
        </div>
        <div className="pointer-events-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <LiveStatus toolCount={data.tools.length} generatedAt={data.generated_at} />
      {flash && (
        <div
          role="status"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-dome px-4 py-2 font-mono text-xs text-sweep"
        >
          {flash}
        </div>
      )}
      {data.tools.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-sm rounded border border-hairline bg-dome/80 p-6 text-center backdrop-blur">
            <p className="eyebrow">first light</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The radar is warming up — the first scan of the tool sky is in progress.
              New tools appear here the moment it completes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
