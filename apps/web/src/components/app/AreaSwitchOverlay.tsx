"use client";

/**
 * Full-canvas loading state shown while the worker re-ingests and re-clusters a
 * newly selected area. Switching takes seconds (a fresh scan → embed → cluster),
 * during which the old landscape is stale; this covers it with an on-brand radar
 * sweep until the new map streams back over SSE.
 */
export function AreaSwitchOverlay({ area }: { area: string }) {
  return (
    <div className="area-overlay absolute inset-0 z-[60] flex items-center justify-center bg-[rgba(4,8,14,0.74)] backdrop-blur-[10px]">
      <div className="flex flex-col items-center px-6 text-center">
        <div className="relative h-[176px] w-[176px]">
          {/* concentric range rings */}
          <div className="absolute inset-0 rounded-full border border-[rgba(116,224,255,0.16)]" />
          <div className="absolute inset-[20%] rounded-full border border-[rgba(116,224,255,0.13)]" />
          <div className="absolute inset-[40%] rounded-full border border-[rgba(116,224,255,0.1)]" />
          {/* crosshair */}
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[rgba(116,224,255,0.08)]" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-[rgba(116,224,255,0.08)]" />
          {/* rotating sweep beam */}
          <div className="area-scope-sweep absolute inset-0 rounded-full" />
          {/* center contact */}
          <div className="live-dot absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#74e0ff] shadow-[0_0_10px_#74e0ff]" />
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5f8299]">
          reconfiguring landscape
        </p>
        <h2 className="mt-2 text-[19px] font-semibold text-[#eaf7ff]">
          Retuning to {area}
        </h2>
        <p className="mt-2.5 max-w-[340px] text-[12.5px] leading-[1.55] text-[#7492a6]">
          Scanning trending repos, embedding them, and re-clustering the new territory. The
          first scan of an area can take up to a minute.
        </p>

        <div className="mt-5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#4d6f86]">
          <span className="area-step h-1.5 w-1.5 rounded-full bg-[#74e0ff]" style={{ animationDelay: "0ms" }} />
          <span>scan</span>
          <span className="text-[#2f4658]">→</span>
          <span className="area-step h-1.5 w-1.5 rounded-full bg-[#74e0ff]" style={{ animationDelay: "220ms" }} />
          <span>embed</span>
          <span className="text-[#2f4658]">→</span>
          <span className="area-step h-1.5 w-1.5 rounded-full bg-[#74e0ff]" style={{ animationDelay: "440ms" }} />
          <span>cluster</span>
        </div>
      </div>
    </div>
  );
}
