"use client";

import type { RadarSettings } from "@/lib/types";

interface Step {
  n: number;
  title: string;
  body: string;
}

function steps(settings: RadarSettings | null, toolCount: number, clusterCount: number): Step[] {
  const p = settings?.pipeline;
  const area = settings?.presets.find((x) => x.slug === settings.area_preset)?.title ?? "the tracked area";
  return [
    { n: 1, title: "Ingest", body: `Trending repos for ${area}, plus a curated seed set, scanned on a schedule. ${toolCount} tools tracked now.` },
    { n: 2, title: "Embed", body: `Each tool's name, description and topics become a ${p?.embedding_dim ?? 384}-dim vector via ${p?.embedding_model ?? "a sentence embedding model"}.` },
    { n: 3, title: "Reduce", body: `Vectors are compressed to ${p?.reduce_to ?? 5} dimensions so density is measurable (BERTopic-style).` },
    { n: 4, title: "Cluster", body: `${p?.algorithm ?? "HDBSCAN"} groups tools by density — no fixed number of clusters. A group needs ≥ ${settings?.min_cluster_size ?? 4} members; the map needs ≥ ${settings?.min_tools ?? 12} tools to cluster at all.` },
    { n: 5, title: "Label", body: `${p?.labeler ?? "c-TF-IDF"} pulls the most distinctive terms from each cluster's tools into its name and keywords. ${clusterCount} clusters formed.` },
    { n: 6, title: "Rank", body: `Momentum (star velocity) and maturity (total stars) place every tool in an adoption ring: Adopt, Trial, Assess or Hold.` },
  ];
}

/**
 * Explains, in plain language, how the emergent clusters are actually produced.
 * Reflects the live configuration so the explanation is never out of date.
 */
export function ClusterExplainer({
  settings,
  toolCount,
  clusterCount,
}: {
  settings: RadarSettings | null;
  toolCount: number;
  clusterCount: number;
}) {
  const list = steps(settings, toolCount, clusterCount);
  return (
    <div className="rounded-2xl border border-[rgba(116,224,255,0.13)] bg-[rgba(8,16,26,0.55)] p-5 backdrop-blur-[16px]">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-[#eaf7ff]">How clusters are determined</h3>
        <span className="font-mono text-[10px] text-[#5f8299]">unsupervised · emergent</span>
      </div>
      <p className="mb-4 max-w-[74ch] text-[12px] leading-[1.55] text-[#6f92a8]">
        Categories are not a hand-written taxonomy. They emerge from the data every scan: tools that describe
        themselves similarly end up near each other, and dense neighbourhoods become clusters. Nothing here is
        keyword-matched by hand.
      </p>
      <ol className="grid list-none grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <li key={s.n} className="rounded-xl border border-[rgba(116,224,255,0.1)] bg-[rgba(4,9,16,0.4)] p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[rgba(116,224,255,0.14)] font-mono text-[11px] text-[#74e0ff]">
                {s.n}
              </span>
              <span className="text-[13px] font-semibold text-[#dcefff]">{s.title}</span>
            </div>
            <p className="text-[11.5px] leading-[1.5] text-[#8aa6ba]">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
