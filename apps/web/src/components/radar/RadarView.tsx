"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLandscapeEvents } from "@/hooks/useLandscapeEvents";
import type { LandscapeData, Tool } from "@/lib/types";

import { LiveStatus } from "./LiveStatus";
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const selected: Tool | null = useMemo(
    () => data.tools.find((t) => t.slug === selectedSlug) ?? null,
    [data.tools, selectedSlug],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <RadarScene
        tools={data.tools}
        clusters={data.clusters}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
      />
      <SearchOverlay tools={data.tools} onSelect={setSelectedSlug} />
      <ToolPanel tool={selected} onClose={() => setSelectedSlug(null)} />
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
