import type { Metadata } from "next";

import { ToolCard } from "@/components/ToolCard";
import { getTools } from "@/lib/api";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Catalog — every tool on the radar",
  description:
    "All trending GitHub repos and AI dev tools currently tracked by AI Radar, ranked by momentum.",
};

export default async function ToolsPage() {
  const tools = await getTools(200).catch(() => []);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-28 pb-24 sm:px-8">
      <p className="eyebrow">catalog</p>
      <h1 className="font-display mt-3 text-5xl text-starlight">
        Every tool on the radar
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
        Ranked by momentum — how fast each tool is gaining stars right now, weighted
        toward the newly launched. Re-scanned automatically, around the clock.
      </p>
      <div className="mt-12">
        {tools.length === 0 ? (
          <p className="border-t border-hairline pt-6 font-mono text-sm text-muted">
            The radar is warming up — the first scan is in progress. Check back in a minute.
          </p>
        ) : (
          tools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)
        )}
      </div>
    </main>
  );
}
