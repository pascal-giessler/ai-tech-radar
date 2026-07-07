"use client";

import Link from "next/link";

import { clusterHue, formatStars, scoreTier } from "@/lib/format";
import type { Tool } from "@/lib/types";

import { RingBadge } from "../RingBadge";

export function ToolPanel({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  if (!tool) return null;
  const hue = tool.cluster_id !== null ? clusterHue(tool.cluster_id) : 220;
  const tier = scoreTier(tool.trend_score);

  return (
    <aside
      aria-label={`Details for ${tool.name}`}
      className="absolute top-20 right-4 z-30 w-[min(22rem,calc(100vw-2rem))] rounded border border-hairline bg-dome/90 p-5 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">
            {tool.owner}
          </p>
          <h2 className="font-display mt-0.5 text-3xl text-starlight">{tool.name}</h2>
          <div className="mt-2">
            <RingBadge ring={tool.ring} size="md" />
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="font-mono text-xs text-muted hover:text-phosphor"
        >
          esc
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">{tool.description}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-hairline py-3 font-mono text-xs">
        <div>
          <dt className="text-muted">stars</dt>
          <dd className="mt-1 text-starlight">★ {formatStars(tool.stars)}</dd>
        </div>
        <div>
          <dt className="text-muted">recent</dt>
          <dd className="mt-1 text-sweep">
            {tool.stars_gained > 0 ? `+${formatStars(tool.stars_gained)}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">momentum</dt>
          <dd className={`mt-1 ${tier === "blazing" ? "text-phosphor" : "text-starlight"}`}>
            {tier}
          </dd>
        </div>
      </dl>

      {tool.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tool.topics.slice(0, 6).map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] text-muted"
            >
              {topic}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center gap-4 text-sm">
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-phosphor-dim px-3 py-1.5 font-mono text-xs text-phosphor transition-colors hover:bg-phosphor hover:text-ink-sky"
        >
          open on GitHub ↗
        </a>
        <Link
          href={`/tools/${tool.slug}`}
          className="font-mono text-xs text-muted hover:text-phosphor"
        >
          full record →
        </Link>
      </div>
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-full rounded-t"
        style={{ background: `hsl(${hue} 70% 62%)` }}
      />
    </aside>
  );
}
