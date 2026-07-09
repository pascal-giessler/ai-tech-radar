"use client";

import { useState } from "react";

import type { SettingsController } from "@/hooks/useSettings";

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </svg>
  );
}

/**
 * Global radar-area switcher for the top bar. The tracked domain is the single
 * most defining choice in the app, so it lives in the header rather than buried
 * in the Clusters config. Selecting a preset re-ingests that domain on the
 * worker; the new landscape streams back over SSE.
 */
export function AreaSelector({ controller }: { controller: SettingsController }) {
  const { settings, saving, save } = controller;
  const [open, setOpen] = useState(false);

  // Keep the header stable while settings load in.
  if (!settings) {
    return (
      <div className="inline-flex h-[33px] w-[132px] animate-pulse items-center rounded-full border border-[rgba(116,224,255,0.12)] bg-[rgba(9,18,30,0.5)]" />
    );
  }

  const current = settings.presets.find((p) => p.slug === settings.area_preset);

  const choose = (slug: string) => {
    setOpen(false);
    if (slug !== settings.area_preset) save({ area_preset: slug }).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch the tracked domain"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-[7px] text-[12.5px] transition-colors disabled:cursor-wait"
        style={{
          borderColor: open ? "rgba(116,224,255,0.45)" : "rgba(116,224,255,0.16)",
          background: open ? "rgba(116,224,255,0.1)" : "rgba(9,18,30,0.5)",
          color: "#cfeaf9",
        }}
      >
        <span className="flex text-[#74e0ff]">
          <GlobeIcon />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#5f8299]">area</span>
        <span className="max-w-[150px] truncate text-[#e2f3ff]">{current?.title ?? settings.area_preset}</span>
        {saving ? (
          <span className="font-mono text-[10px] text-[#74e0ff]">·switching</span>
        ) : (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5f8299"
            strokeWidth="2.4"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s ease" }}
          >
            <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute right-0 top-[42px] z-50 min-w-[230px] list-none rounded-xl border border-[rgba(116,224,255,0.18)] bg-[rgba(9,17,28,0.96)] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.6)] backdrop-blur-[20px]"
          >
            {settings.presets.map((p) => {
              const active = p.slug === settings.area_preset;
              return (
                <li key={p.slug} role="option" aria-selected={active}>
                  <button
                    onClick={() => choose(p.slug)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-[rgba(116,224,255,0.08)]"
                    style={{ color: active ? "#e2f3ff" : "#93b4c9" }}
                  >
                    <span
                      className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border"
                      style={{
                        borderColor: active ? "#74e0ff" : "rgba(116,224,255,0.3)",
                        background: active ? "#74e0ff" : "transparent",
                      }}
                    >
                      {active && <span className="h-[6px] w-[6px] rounded-full bg-[#03121a]" />}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </button>
                </li>
              );
            })}
            <li className="mt-1 border-t border-[rgba(116,224,255,0.1)] px-2.5 pb-1 pt-2 text-[10.5px] leading-[1.45] text-[#4d6f86]">
              Swaps the radar to that domain — re-ingests and prunes the previous area. Add your own in the Clusters
              panel.
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
