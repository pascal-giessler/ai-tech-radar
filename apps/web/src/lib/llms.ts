import type { LandscapeData } from "./types";

/**
 * Builds the llms.txt manifest: a compact, markdown-shaped map of the whole
 * landscape so agents can answer "what tools exist for X?" without scraping.
 */
export function buildLlmsTxt(data: LandscapeData, siteUrl: string): string {
  const lines: string[] = [
    "# AI Radar",
    "",
    "> A live semantic landscape of trending GitHub repos and AI developer tools.",
    "> Tools are clustered automatically by what they do (embeddings), ranked by",
    "> star momentum, and re-scanned continuously. Clusters are emergent, not curated.",
    "",
    `Landscape JSON: ${siteUrl}/api/landscape`,
    `Catalog: ${siteUrl}/tools`,
    "",
  ];

  const byCluster = new Map<number, typeof data.tools>();
  for (const tool of data.tools) {
    if (tool.cluster_id === null) continue;
    byCluster.set(tool.cluster_id, [...(byCluster.get(tool.cluster_id) ?? []), tool]);
  }

  for (const cluster of data.clusters) {
    lines.push(`## ${cluster.label}`);
    lines.push("");
    const members = (byCluster.get(cluster.id) ?? []).sort(
      (a, b) => b.trend_score - a.trend_score,
    );
    for (const tool of members) {
      const desc = tool.description ? `: ${tool.description}` : "";
      lines.push(
        `- [${tool.owner}/${tool.name}](${siteUrl}/tools/${tool.slug})${desc} (${tool.stars} stars)`,
      );
    }
    lines.push("");
  }

  lines.push(`Generated: ${data.generated_at}`);
  return lines.join("\n");
}
