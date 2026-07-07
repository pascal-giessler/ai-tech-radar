import Link from "next/link";

import { clusterHue } from "@/lib/format";
import type { Cluster, Tool } from "@/lib/types";

/**
 * The crawlable text form of the landscape, rendered under the 3D canvas on `/`.
 * Search engines and agents read this; humans scroll into it for a linkable index.
 */
export function LandscapeIndex({
  clusters,
  tools,
}: {
  clusters: Cluster[];
  tools: Tool[];
}) {
  const byCluster = new Map<number, Tool[]>();
  for (const tool of tools) {
    if (tool.cluster_id === null) continue;
    byCluster.set(tool.cluster_id, [...(byCluster.get(tool.cluster_id) ?? []), tool]);
  }

  return (
    <section aria-label="Landscape index" className="mx-auto w-full max-w-4xl px-5 py-20 sm:px-8">
      <p className="eyebrow">the atlas, in text</p>
      <h2 className="font-display mt-3 text-4xl text-starlight">
        Every territory, every tool
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        The same landscape the radar draws above, written down. Each territory is a
        semantic cluster discovered from what the tools actually do — not a hand-made
        category.
      </p>
      <div className="mt-12 space-y-14">
        {clusters.map((cluster) => {
          const members = (byCluster.get(cluster.id) ?? [])
            .sort((a, b) => b.trend_score - a.trend_score)
            .slice(0, 12);
          return (
            <div key={cluster.id}>
              <h3 className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 self-center rounded-full"
                  style={{ background: `hsl(${clusterHue(cluster.id)} 70% 62%)` }}
                />
                <Link
                  href={`/clusters/${cluster.slug}`}
                  className="font-display text-2xl text-starlight hover:text-phosphor"
                >
                  {cluster.label}
                </Link>
                <span className="font-mono text-xs text-muted">
                  {cluster.size} tool{cluster.size === 1 ? "" : "s"}
                </span>
              </h3>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {members.map((tool) => (
                  <li key={tool.slug} className="border-b border-hairline py-2.5">
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="text-sm text-starlight hover:text-phosphor"
                    >
                      {tool.owner}/{tool.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {tool.description.slice(0, 72)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
