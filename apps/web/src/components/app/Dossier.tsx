"use client";

import {
  PATTERN_LABEL,
  STEPS,
  TIER_BG,
  TIER_COLOR,
  clusterColor,
  formatStars,
  type ScopeNode,
} from "@/lib/cinematic";
import { SCORE_EXPLAINER, ringReason } from "@/lib/explain";

import { InfoTip } from "./InfoTip";
import { ActivityBars, RingPill } from "./signals";

function sparkPoints(node: ScopeNode, W: number, H: number, top: number) {
  const ST = STEPS - 1;
  return node.hist.map((p, i) => `${((i / ST) * W).toFixed(1)},${(H - (p.score / 100) * (H - top)).toFixed(1)}`);
}

/** Slide-in detail panel (right overlay). */
export function DetailPanel({
  node,
  onClose,
  onOpenDossier,
}: {
  node: ScopeNode;
  onClose: () => void;
  onOpenDossier: () => void;
}) {
  const bar = clusterColor(node.hue, 0.78, 0.15);
  const spark = clusterColor(node.hue, 0.8, 0.14);
  const pts = node.hist.map(
    (p, idx) => `${((idx / (STEPS - 1)) * 300).toFixed(1)},${(40 - (p.score / 100) * 37 - 1.5).toFixed(1)}`,
  );
  const peak = Math.max(...node.hist.map((p) => p.score));

  return (
    <aside
      className="absolute right-5 top-5 bottom-5 z-30 w-[min(23rem,calc(100%-40px))] overflow-auto rounded-[18px] border border-[rgba(116,224,255,0.2)] bg-[rgba(8,16,26,0.72)] p-[22px] shadow-[0_24px_70px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(160,235,255,0.1),0_0_0_1px_rgba(116,224,255,0.05)] backdrop-blur-[24px]"
      style={{ animation: "fade-up 0.3s cubic-bezier(0.2,0.8,0.2,1)" }}
    >
      <div className="absolute left-0 top-0 h-0.5 w-full" style={{ background: bar, boxShadow: `0 0 14px ${bar}` }} />
      <span className="absolute left-[9px] top-[9px] h-3 w-3 border-l border-t border-[rgba(116,224,255,0.55)]" />
      <span className="absolute right-[9px] top-[9px] h-3 w-3 border-r border-t border-[rgba(116,224,255,0.55)]" />

      <div className="flex items-start justify-between gap-3.5">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#5f8299]">{node.owner}</div>
          <h2 className="mt-[5px] text-[26px] font-normal leading-[1.08] tracking-[0.005em] text-[#f2fbff]">{node.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="h-[30px] w-[30px] flex-none rounded-[9px] border border-[rgba(116,224,255,0.18)] bg-[rgba(9,18,30,0.6)] text-[15px] leading-none text-[#93b4c9]"
        >
          ×
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <RingPill ring={node.ring} size="md" />
        <span
          className="inline-flex items-center gap-[7px] rounded-full px-[11px] py-1 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ background: TIER_BG[node.tier], color: TIER_COLOR[node.tier] }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLOR[node.tier] }} />
          {node.tier}
        </span>
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-[#6f92a8]">Why {node.ring ?? "unrated"}: {ringReason(node.stars, node.score)}</p>

      <p className="mt-3.5 text-sm leading-[1.58] text-[#93b4c9]">{node.description}</p>

      <dl className="my-4 grid grid-cols-4 gap-2 border-y border-[rgba(116,224,255,0.12)] py-[15px] font-mono text-xs">
        <div>
          <dt className="text-[#5f8299]">stars</dt>
          <dd className="mt-[5px] text-[#e2f3ff]">★ {formatStars(node.stars)}</dd>
        </div>
        <div>
          <dt className="text-[#5f8299]">30-day</dt>
          <dd className="mt-[5px] text-[#57e0a8]">{node.gained > 0 ? "+" + formatStars(node.gained) : "—"}</dd>
        </div>
        <div>
          <dt className="text-[#5f8299]">issues</dt>
          <dd className="mt-[5px] text-[#e2f3ff]">{formatStars(node.openIssues)}</dd>
        </div>
        <div>
          <dt className="inline-flex items-center gap-1 text-[#5f8299]">momentum <InfoTip text={SCORE_EXPLAINER} /></dt>
          <dd className="mt-[5px] text-[#e2f3ff]">{node.score}</dd>
        </div>
      </dl>

      {node.commitActivity.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#5f8299]">
            commits / week · last {Math.min(12, node.commitActivity.length)}w (real)
          </div>
          <ActivityBars weeks={node.commitActivity} height={26} />
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#5f8299]">
          <span>13-week momentum · {PATTERN_LABEL[node.pattern] ?? node.pattern}</span>
          <span>peak {peak}</span>
        </div>
        <svg viewBox="0 0 300 40" preserveAspectRatio="none" width="100%" height="40" className="block overflow-visible">
          <polyline points={`0,40 ${pts.join(" ")} 300,40`} fill={spark} style={{ fillOpacity: 0.14, stroke: "none" }} />
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke={spark}
            style={{ strokeWidth: "1.8px", strokeLinejoin: "round", strokeLinecap: "round", filter: `drop-shadow(0 0 4px ${spark})` }}
          />
        </svg>
      </div>

      <ul className="mb-5 flex list-none flex-wrap gap-1.5">
        {node.topics.slice(0, 6).map((t) => (
          <li key={t} className="rounded-full border border-[rgba(116,224,255,0.16)] px-2.5 py-[3px] font-mono text-[10px] text-[#93b4c9]">
            {t}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[11px] border border-[rgba(116,224,255,0.24)] bg-[rgba(116,224,255,0.06)] px-[15px] py-[9px] text-[13px] font-medium text-[#cfefff]"
        >
          Open on GitHub ↗
        </a>
        <button onClick={onOpenDossier} className="text-[13px] text-[#74e0ff]">
          Full dossier →
        </button>
      </div>
    </aside>
  );
}

/** Full-screen dossier. */
export function FullDossier({ node, nodes, onClose, onPick }: { node: ScopeNode; nodes: ScopeNode[]; onClose: () => void; onPick: (slug: string) => void }) {
  const catColor = clusterColor(node.hue, 0.78, 0.15);
  const clusterTools = nodes.filter((n) => n.cid === node.cid).sort((a, b) => b.score - a.score);
  const rank = clusterTools.indexOf(node) + 1;
  const related = clusterTools.filter((n) => n !== node);
  const scorePts = sparkPoints(node, 640, 190, 10);
  const maxSt = Math.max(1, ...node.hist.map((p) => p.stars));
  const starPts = node.hist.map((p, i) => `${((i / (STEPS - 1)) * 640).toFixed(1)},${(112 - (p.stars / maxSt) * 104).toFixed(1)}`);
  const peak = Math.max(...node.hist.map((p) => p.score));

  return (
    <div
      className="absolute inset-0 z-50 overflow-auto"
      style={{
        background: "radial-gradient(120% 90% at 50% -5%, #0b1728 0%, #05090f 62%, #03060c 100%)",
        animation: "fade-up 0.3s cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      <div className="sticky top-0 z-[5] flex items-center justify-between gap-4 border-b border-[rgba(116,224,255,0.12)] bg-[rgba(6,12,20,0.72)] px-7 py-[15px] backdrop-blur-[22px]">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-[10px] border border-[rgba(116,224,255,0.2)] bg-[rgba(116,224,255,0.05)] px-3.5 py-2 text-[13px] font-medium text-[#cfefff]"
        >
          ‹ Back
        </button>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5f8299]">Full dossier</div>
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[10px] border border-[rgba(116,224,255,0.24)] bg-[rgba(116,224,255,0.06)] px-[15px] py-2 text-[13px] font-medium text-[#cfefff]"
        >
          Open on GitHub ↗
        </a>
      </div>

      <div className="mx-auto max-w-[1080px] px-7 pb-16 pt-[34px]">
        <div className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-[#5f8299]">{node.owner}</div>
        <h1 className="mt-2 text-[46px] font-normal leading-none tracking-[0.004em] text-[#f2fbff]">{node.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(116,224,255,0.16)] px-3 py-[5px] text-[12.5px] text-[#93b4c9]">
            <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: catColor, boxShadow: `0 0 8px ${catColor}` }} />
            {node.clusterLabel}
          </span>
          <RingPill ring={node.ring} size="md" />
          <span
            className="inline-flex items-center gap-[7px] rounded-full px-3 py-[5px] font-mono text-[10.5px] uppercase tracking-[0.1em]"
            style={{ background: TIER_BG[node.tier], color: TIER_COLOR[node.tier] }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLOR[node.tier], boxShadow: `0 0 8px ${TIER_COLOR[node.tier]}` }} />
            {node.tier}
          </span>
          <span className="font-mono text-[11.5px] text-[#5f8299]">
            rank #{rank} of {clusterTools.length}
          </span>
        </div>

        <p className="mt-[22px] max-w-[66ch] text-[17px] leading-[1.55] text-[#a9c6d8]">{node.description}</p>

        <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-[22px]">
          {/* charts */}
          <div className="flex min-w-0 flex-col gap-[22px]">
            <div className="relative rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <span className="absolute left-[9px] top-[9px] h-[11px] w-[11px] border-l border-t border-[rgba(116,224,255,0.45)]" />
              <span className="absolute right-[9px] top-[9px] h-[11px] w-[11px] border-r border-t border-[rgba(116,224,255,0.45)]" />
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f8299]">
                <span>Momentum · 13 weeks (modeled)</span>
                <span>peak {peak} · now {node.score}</span>
              </div>
              <svg viewBox="0 0 640 200" width="100%" preserveAspectRatio="none" className="mt-4 block h-[180px] overflow-visible">
                {[10, 55, 100, 145, 190].map((y) => (
                  <line key={y} x1="0" y1={y} x2="640" y2={y} stroke={y === 190 ? "rgba(116,224,255,0.14)" : "rgba(116,224,255,0.07)"} strokeWidth="1" />
                ))}
                <polyline points={`0,190 ${scorePts.join(" ")} 640,190`} fill={catColor} style={{ fillOpacity: 0.12, stroke: "none" }} />
                <polyline
                  points={scorePts.join(" ")}
                  fill="none"
                  stroke={catColor}
                  style={{ strokeWidth: "2.4px", strokeLinejoin: "round", strokeLinecap: "round", filter: `drop-shadow(0 0 6px ${catColor})` }}
                />
              </svg>
            </div>
            <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f8299]">Stars · 13 weeks (modeled)</div>
              <svg viewBox="0 0 640 120" width="100%" preserveAspectRatio="none" className="mt-3 block h-[110px] overflow-visible">
                <polyline points={`0,120 ${starPts.join(" ")} 640,120`} fill="#57e0a8" style={{ fillOpacity: 0.1, stroke: "none" }} />
                <polyline points={starPts.join(" ")} fill="none" stroke="#57e0a8" style={{ strokeWidth: "2px", strokeLinejoin: "round" }} />
              </svg>
            </div>
            <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5">
              <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f8299]">
                <span>Maintenance · commits/week (real)</span>
                <span>{formatStars(node.openIssues)} open issues</span>
              </div>
              {node.commitActivity.length > 0 ? (
                <ActivityBars weeks={node.commitActivity} count={12} height={44} />
              ) : (
                <div className="text-[12px] text-[#4d6f86]">No commit-activity data available from GitHub for this repo.</div>
              )}
            </div>
          </div>

          {/* related + topics */}
          <div className="flex min-w-0 flex-col gap-[22px]">
            <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f8299]">Same category</div>
              <ul className="flex list-none flex-col gap-1">
                {related.map((r) => (
                  <li key={r.slug}>
                    <button onClick={() => onPick(r.slug)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[rgba(116,224,255,0.06)]">
                      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: clusterColor(r.hue, 0.78, 0.15) }} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#c6deec]">
                        {r.owner}/{r.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#5f8299]">{r.score}</span>
                    </button>
                  </li>
                ))}
                {related.length === 0 && <li className="px-2 py-2 text-[12.5px] text-[#4d6f86]">No other tracked contacts here yet.</li>}
              </ul>
            </div>
            {node.topics.length > 0 && (
              <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f8299]">Topics</div>
                <ul className="flex list-none flex-wrap gap-2">
                  {node.topics.map((t) => (
                    <li key={t} className="rounded-full border border-[rgba(116,224,255,0.16)] px-3 py-1 font-mono text-[11px] text-[#93b4c9]">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
