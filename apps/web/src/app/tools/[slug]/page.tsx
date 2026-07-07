import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RingBadge } from "@/components/RingBadge";
import { SiteHeader } from "@/components/SiteHeader";
import { getClusters, getTool } from "@/lib/api";
import { formatStars, scoreTier } from "@/lib/format";
import { ringMeta } from "@/lib/rings";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: `${tool.name} by ${tool.owner}`,
    description: `${tool.description} — ${formatStars(tool.stars)} stars, momentum: ${scoreTier(tool.trend_score)}. Tracked live on AI Radar.`,
  };
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = await getTool(slug);
  if (!tool) notFound();

  const clusters = await getClusters().catch(() => []);
  const cluster = clusters.find((c) => c.id === tool.cluster_id) ?? null;
  const tier = scoreTier(tool.trend_score);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: tool.name,
        description: tool.description,
        url: tool.url,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        author: { "@type": "Organization", name: tool.owner },
        additionalProperty: tool.ring
          ? [
              {
                "@type": "PropertyValue",
                name: "AI Radar adoption ring",
                value: ringMeta(tool.ring).label,
              },
            ]
          : undefined,
        aggregateRating: undefined,
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: tool.stars,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI Radar", item: "/" },
          { "@type": "ListItem", position: 2, name: "Catalog", item: "/tools" },
          { "@type": "ListItem", position: 3, name: tool.name },
        ],
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-12 pb-24 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted">
        <Link href="/" className="hover:text-phosphor">
          radar
        </Link>
        {" / "}
        <Link href="/tools" className="hover:text-phosphor">
          catalog
        </Link>
        {" / "}
        <span className="text-starlight">{tool.slug}</span>
      </nav>

      <p className="eyebrow mt-10">{tool.owner}</p>
      <h1 className="font-display mt-2 text-6xl text-starlight">{tool.name}</h1>
      <div className="mt-4 flex items-center gap-3">
        <RingBadge ring={tool.ring} size="md" />
        {tool.ring && (
          <span className="text-sm text-muted">{ringMeta(tool.ring).blurb}</span>
        )}
      </div>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{tool.description}</p>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded border border-hairline bg-hairline sm:grid-cols-4">
        {[
          ["stars", `★ ${formatStars(tool.stars)}`],
          ["gained recently", tool.stars_gained > 0 ? `+${formatStars(tool.stars_gained)}` : "—"],
          ["momentum", tier],
          ["language", tool.language ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-dome p-4">
            <dt className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
              {label}
            </dt>
            <dd
              className={`mt-2 font-mono text-lg ${
                label === "momentum" && tier === "blazing" ? "text-phosphor" : "text-starlight"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {cluster && (
        <section className="mt-10 border-t border-hairline pt-6">
          <h2 className="font-mono text-xs tracking-[0.2em] text-muted uppercase">territory</h2>
          <p className="mt-2 text-sm text-muted">
            On the radar, <span className="text-starlight">{tool.name}</span> sits in{" "}
            <Link
              href={`/clusters/${cluster.slug}`}
              className="text-phosphor underline-offset-4 hover:underline"
            >
              {cluster.label}
            </Link>{" "}
            with {cluster.size - 1} semantic neighbours — tools solving the same kind of
            problem.
          </p>
        </section>
      )}

      {tool.topics.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {tool.topics.map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-hairline px-3 py-1 font-mono text-xs text-muted"
            >
              {topic}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12">
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border border-phosphor-dim px-5 py-2.5 font-mono text-sm text-phosphor transition-colors hover:bg-phosphor hover:text-ink-sky"
        >
          open on GitHub ↗
        </a>
      </div>
      </main>
    </>
  );
}
