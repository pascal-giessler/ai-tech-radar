"use client";

import { useMemo, useState } from "react";

import {
  ACCENT,
  COLOR_OPTS,
  TIER_COLOR,
  cineTier,
  clusterColor,
  type ScopeCluster,
  type ScopeNode,
} from "@/lib/cinematic";

interface Candidate {
  label: string;
  hue: number;
  keywords: string;
  count: number;
}

export function ClustersView({ nodes, clusters }: { nodes: ScopeNode[]; clusters: ScopeCluster[] }) {
  const [ncName, setNcName] = useState("");
  const [ncHue, setNcHue] = useState(195);
  const [ncKeywords, setNcKeywords] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const categories = useMemo(
    () =>
      clusters.map((c) => {
        const ts = nodes.filter((n) => n.cid === c.id);
        const avg = ts.length ? Math.round(ts.reduce((a, n) => a + n.score, 0) / ts.length) : 0;
        const top = ts.slice().sort((a, b) => b.score - a.score)[0];
        const tier = cineTier(avg);
        return { ...c, avg, tier, tierColor: TIER_COLOR[tier], topName: top ? `${top.owner}/${top.name}` : "—" };
      }),
    [clusters, nodes],
  );

  const kw = ncKeywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const matched = kw.length ? nodes.filter((n) => kw.some((k) => n.hay.includes(k))) : [];
  const canCreate = ncName.trim().length > 0;
  const previewColor = `oklch(0.82 0.15 ${ncHue})`;

  const create = () => {
    if (!canCreate) return;
    setCandidates((cs) => [{ label: ncName.trim(), hue: ncHue, keywords: ncKeywords.trim(), count: matched.length }, ...cs]);
    setNcName("");
    setNcKeywords("");
  };

  const label =
    "mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#5f8299]";
  const input =
    "w-full rounded-[10px] border border-[rgba(116,224,255,0.16)] bg-[rgba(9,18,30,0.7)] px-3 py-2.5 text-[13.5px] text-[#e2f3ff]";

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(360px,1fr))] items-start gap-7 px-7 pb-14 pt-6">
        {/* left: active categories + proposed */}
        <div className="flex min-w-0 flex-col gap-[22px]">
          <div className="min-w-0">
            <div className={label}>Active categories</div>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[14px] border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-[14px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-[9px]">
                      <span
                        className="h-[11px] w-[11px] flex-none rounded-[3px]"
                        style={{ background: clusterColor(c.hue, 0.78, 0.15), boxShadow: `0 0 10px ${clusterColor(c.hue, 0.78, 0.15)}` }}
                      />
                      <span className="truncate text-[13.5px] font-semibold text-[#eaf7ff]">{c.label}</span>
                    </div>
                    <span className="flex-none font-mono text-[11px] text-[#5f8299]">{c.count}</span>
                  </div>
                  <div className="mt-[11px] flex items-baseline justify-between font-mono text-[11px] text-[#5f8299]">
                    <span>
                      avg score <span className="text-[#e2f3ff]">{c.avg}</span>
                    </span>
                    <span style={{ color: c.tierColor }}>{c.tier}</span>
                  </div>
                  <div className="mt-2 truncate border-t border-[rgba(116,224,255,0.09)] pt-[9px] text-[11.5px] text-[#93b4c9]">
                    lead · {c.topName}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {candidates.length > 0 && (
            <div>
              <div className={label}>Proposed clusters</div>
              <div className="flex flex-col gap-2.5">
                {candidates.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-[rgba(116,224,255,0.4)] bg-[rgba(116,224,255,0.05)] px-[15px] py-[13px]"
                  >
                    <span className="h-[11px] w-[11px] flex-none rounded-[3px]" style={{ background: `oklch(0.78 0.15 ${c.hue})`, boxShadow: `0 0 10px oklch(0.78 0.15 ${c.hue})` }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-[#eaf7ff]">{c.label}</span>
                        <span className="rounded-[5px] border border-[rgba(116,224,255,0.4)] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-[#74e0ff]">
                          candidate
                        </span>
                      </div>
                      <div className="mt-[3px] font-mono text-[11px] text-[#5f8299]">
                        {c.count} matching contacts · seeds: {c.keywords || "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => setCandidates((cs) => cs.filter((_, i) => i !== idx))}
                      className="h-7 w-7 flex-none rounded-lg border border-[rgba(116,224,255,0.18)] bg-[rgba(9,18,30,0.6)] text-sm leading-none text-[#93b4c9]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* right: candidate builder */}
        <div className="sticky top-0 min-w-0 rounded-2xl border border-[rgba(116,224,255,0.16)] bg-[rgba(8,16,26,0.6)] p-[22px] shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(160,235,255,0.06)] backdrop-blur-[18px]">
          <h3 className="m-0 mb-1 text-base font-medium tracking-[0.02em] text-[#eaf7ff]">New candidate cluster</h3>
          <p className="m-0 mb-[18px] text-[12.5px] leading-[1.5] text-[#5f8299]">
            Propose an emerging category by seeding it with keywords. Preview how many tracked contacts fall into orbit
            before you commit.
          </p>

          <label className={`block ${label.replace("mb-3", "mb-[7px]")}`}>Cluster name</label>
          <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="e.g. multimodal pipelines" className={`${input} mb-[18px]`} />

          <label className={`block ${label.replace("mb-3", "mb-[9px]")}`}>Signal color</label>
          <div className="mb-[18px] flex gap-[9px]">
            {COLOR_OPTS.map((h) => (
              <button
                key={h}
                onClick={() => setNcHue(h)}
                aria-label="Pick color"
                className="h-[26px] w-[26px] rounded-lg"
                style={{
                  background: `oklch(0.78 0.15 ${h})`,
                  border: ncHue === h ? "2px solid #04070d" : "2px solid transparent",
                  boxShadow: ncHue === h ? `0 0 0 2px oklch(0.78 0.15 ${h}), 0 0 12px oklch(0.78 0.15 ${h})` : "none",
                }}
              />
            ))}
          </div>

          <label className={`block ${label.replace("mb-3", "mb-[7px]")}`}>Seed keywords</label>
          <input
            value={ncKeywords}
            onChange={(e) => setNcKeywords(e.target.value)}
            placeholder="vision, image, audio, multimodal"
            className={`${input} mb-1.5 font-mono`}
          />
          <div className="mb-4 text-[11px] text-[#4d6f86]">Comma or space separated.</div>

          <div className="mb-[18px] rounded-xl border border-[rgba(116,224,255,0.12)] bg-[rgba(116,224,255,0.03)] p-3.5">
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold" style={{ color: previewColor, textShadow: `0 0 16px ${previewColor}` }}>
                {matched.length}
              </span>
              <span className="text-[12.5px] text-[#5f8299]">of {nodes.length} contacts match</span>
            </div>
            {matched.length > 0 ? (
              <ul className="flex list-none flex-wrap gap-1.5">
                {matched.slice(0, 6).map((n) => (
                  <li key={n.slug} className="rounded-full border border-[rgba(116,224,255,0.16)] px-[9px] py-[3px] font-mono text-[10.5px] text-[#93b4c9]">
                    {n.owner}/{n.name}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-[#4d6f86]">Add keywords to preview matching contacts.</div>
            )}
          </div>

          <button
            onClick={create}
            disabled={!canCreate}
            className="w-full rounded-[11px] py-[11px] text-sm font-semibold tracking-[0.02em] text-[#03121a]"
            style={{
              background: canCreate ? ACCENT : "rgba(116,224,255,0.16)",
              boxShadow: canCreate ? "0 0 26px rgba(116,224,255,0.4)" : "none",
              cursor: canCreate ? "pointer" : "not-allowed",
            }}
          >
            Create candidate cluster
          </button>
        </div>
      </div>
    </div>
  );
}
