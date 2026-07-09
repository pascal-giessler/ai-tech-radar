"use client";

import { useEffect, useState } from "react";

import type { SettingsController } from "@/hooks/useSettings";

const label = "font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f8299]";

/** Live clustering configuration: what to track, how finely, and re-scan on demand. */
export function SettingsPanel({ controller }: { controller: SettingsController }) {
  const { settings, loading, saving, error, save, createArea } = controller;
  const [minClusterSize, setMinClusterSize] = useState(4);
  const [minTools, setMinTools] = useState(12);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const submitArea = async () => {
    setAddError(null);
    const list = topics.split(",").map((t) => t.trim()).filter(Boolean);
    if (!title.trim() || list.length === 0) {
      setAddError("Give the area a name and at least one topic.");
      return;
    }
    try {
      const created = await createArea(title.trim(), list);
      setTitle("");
      setTopics("");
      setAdding(false);
      await save({ area_preset: created.slug }).catch(() => {}); // switch to it now
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not create the area.");
    }
  };

  useEffect(() => {
    if (settings) {
      setMinClusterSize(settings.min_cluster_size);
      setMinTools(settings.min_tools);
    }
  }, [settings]);

  if (loading && !settings) {
    return (
      <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-[rgba(116,224,255,0.1)]" />
        <div className="mt-4 h-24 animate-pulse rounded bg-[rgba(116,224,255,0.06)]" />
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="rounded-2xl border border-[rgba(255,120,120,0.2)] bg-[rgba(30,12,12,0.4)] p-5 text-[13px] text-[#e6a9a9]">
        Configuration unavailable{error ? `: ${error}` : ""}. The API may still be warming up.
      </div>
    );
  }

  const dirty = minClusterSize !== settings.min_cluster_size || minTools !== settings.min_tools;

  return (
    <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-[16px]">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#eaf7ff]">Configuration</h3>
        {saving && <span className="font-mono text-[10px] text-[#74e0ff]">saving…</span>}
      </div>
      <p className="mb-4 text-[12px] leading-[1.5] text-[#6f92a8]">
        Changes re-run the semantic pipeline on the worker and stream back live. Everything here is self-host
        configurable.
      </p>

      {error && <div className="mb-3 rounded-lg border border-[rgba(255,120,120,0.24)] bg-[rgba(40,14,14,0.4)] px-3 py-2 text-[12px] text-[#e6a9a9]">{error}</div>}

      {/* Area preset */}
      <div className="mb-5">
        <div className={`${label} mb-2`}>Radar area</div>
        <div className="flex flex-wrap gap-2">
          {settings.presets.map((p) => {
            const active = p.slug === settings.area_preset;
            return (
              <button
                key={p.slug}
                disabled={saving}
                onClick={() => !active && save({ area_preset: p.slug }).catch(() => {})}
                className="rounded-[9px] border px-3 py-[7px] text-[12.5px] transition-colors disabled:opacity-60"
                style={{
                  borderColor: active ? "rgba(116,224,255,0.5)" : "rgba(116,224,255,0.16)",
                  background: active ? "rgba(116,224,255,0.12)" : "rgba(9,18,30,0.55)",
                  color: active ? "#e2f3ff" : "#93b4c9",
                }}
              >
                {p.title}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-[#4d6f86]">
          Switching swaps the radar to that domain: it re-ingests trending repos and prunes the previous area.
        </div>

        {/* Add a custom area */}
        {adding ? (
          <div className="mt-3 rounded-xl border border-[rgba(116,224,255,0.16)] bg-[rgba(6,13,22,0.6)] p-3">
            <div className={`${label} mb-1.5`}>New area</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name — e.g. Data Engineering"
              maxLength={64}
              className="mb-2 w-full rounded-lg border border-[rgba(116,224,255,0.16)] bg-[rgba(9,18,30,0.7)] px-2.5 py-2 text-[12.5px] text-[#e2f3ff] placeholder:text-[#4d6f86]"
            />
            <input
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="GitHub topics, comma-separated — e.g. etl, spark, airflow"
              className="w-full rounded-lg border border-[rgba(116,224,255,0.16)] bg-[rgba(9,18,30,0.7)] px-2.5 py-2 text-[12.5px] text-[#e2f3ff] placeholder:text-[#4d6f86]"
            />
            {addError && <div className="mt-2 text-[11px] text-[#e6a9a9]">{addError}</div>}
            <div className="mt-2 text-[10.5px] leading-[1.45] text-[#4d6f86]">
              Creates the area and switches to it — the radar re-scans those topics live.
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                disabled={saving}
                onClick={submitArea}
                className="rounded-[9px] px-3 py-[7px] text-[12px] font-semibold text-[#03121a] transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: "#74e0ff" }}
              >
                Add &amp; switch
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setAddError(null);
                }}
                className="rounded-[9px] border border-[rgba(116,224,255,0.16)] px-3 py-[7px] text-[12px] text-[#93b4c9] transition-colors hover:text-[#e2f3ff]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] border border-dashed border-[rgba(116,224,255,0.28)] px-3 py-[7px] text-[12px] text-[#93b4c9] transition-colors hover:border-[rgba(116,224,255,0.5)] hover:text-[#e2f3ff]"
          >
            <span className="text-[14px] leading-none text-[#74e0ff]">+</span> New area
          </button>
        )}
      </div>

      {/* Granularity */}
      <div className="mb-4">
        <div className={`${label} mb-2`}>Cluster granularity</div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#5f8299]">many small</span>
          <input
            type="range"
            min={2}
            max={20}
            value={minClusterSize}
            onChange={(e) => setMinClusterSize(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[#74e0ff]"
            aria-label="Minimum cluster size"
          />
          <span className="font-mono text-[10px] text-[#5f8299]">few big</span>
          <span className="w-6 text-right font-mono text-[12px] text-[#e2f3ff]">{minClusterSize}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-[#4d6f86]">
          Minimum tools HDBSCAN needs to call something a cluster. Lower = more, tighter niches; higher = fewer,
          broader territories.
        </div>
      </div>

      {/* Min tools */}
      <div className="mb-5">
        <div className={`${label} mb-2`}>Minimum tools before clustering</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={60}
            value={minTools}
            onChange={(e) => setMinTools(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[#74e0ff]"
            aria-label="Minimum tools before clustering"
          />
          <span className="w-6 text-right font-mono text-[12px] text-[#e2f3ff]">{minTools}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-[#4d6f86]">
          Below this the map stays a single &ldquo;Uncharted&rdquo; field until enough tools are tracked.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          disabled={!dirty || saving}
          onClick={() => save({ min_cluster_size: minClusterSize, min_tools: minTools }).catch(() => {})}
          className="rounded-[10px] px-4 py-[9px] text-[13px] font-semibold text-[#03121a] transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
          style={{ background: dirty && !saving ? "#74e0ff" : "rgba(116,224,255,0.16)", color: dirty && !saving ? "#03121a" : "#5f8299" }}
        >
          Apply &amp; recompute
        </button>
        <button
          disabled={saving}
          onClick={() => save({ area_preset: settings.area_preset }).catch(() => {})}
          className="rounded-[10px] border border-[rgba(116,224,255,0.2)] px-4 py-[9px] text-[13px] text-[#cfefff] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          Re-scan now
        </button>
      </div>
    </div>
  );
}
