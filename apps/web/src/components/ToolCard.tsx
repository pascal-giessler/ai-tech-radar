import Link from "next/link";

import { clusterHue, formatStars, scoreTier } from "@/lib/format";
import type { Tool } from "@/lib/types";

const TIER_COPY: Record<string, string> = {
  blazing: "blazing",
  rising: "rising",
  steady: "steady",
  quiet: "quiet",
};

export function ToolCard({ tool }: { tool: Tool }) {
  const hue = tool.cluster_id !== null ? clusterHue(tool.cluster_id) : 220;
  const tier = scoreTier(tool.trend_score);
  return (
    <article className="hairline-row group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 border-b border-hairline py-4">
      <span
        aria-hidden
        className="h-2 w-2 self-center rounded-full"
        style={{ background: `hsl(${hue} 70% 62%)` }}
      />
      <div className="min-w-0">
        <h3 className="truncate">
          <Link
            href={`/tools/${tool.slug}`}
            className="font-medium text-starlight transition-colors group-hover:text-phosphor"
          >
            {tool.owner}/<span className="font-semibold">{tool.name}</span>
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{tool.description}</p>
      </div>
      <div className="text-right font-mono text-xs text-muted">
        <div className="text-starlight">★ {formatStars(tool.stars)}</div>
        <div className="mt-1">
          {tool.stars_gained > 0 && (
            <span className="text-sweep">+{formatStars(tool.stars_gained)} · </span>
          )}
          <span className={tier === "blazing" ? "text-phosphor" : ""}>{TIER_COPY[tier]}</span>
        </div>
      </div>
    </article>
  );
}
