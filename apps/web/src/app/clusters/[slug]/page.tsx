import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { ToolCard } from "@/components/ToolCard";
import { getCluster } from "@/lib/api";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getCluster(slug);
  if (!detail) return { title: "Territory not found" };
  return {
    title: `${detail.cluster.label} — tools for this territory`,
    description: `${detail.cluster.size} trending tools clustered around "${detail.cluster.label}", discovered semantically and ranked by momentum on AI Radar.`,
  };
}

export default async function ClusterPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getCluster(slug);
  if (!detail) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${detail.cluster.label} — AI Radar territory`,
    numberOfItems: detail.tools.length,
    itemListElement: detail.tools.slice(0, 25).map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${tool.owner}/${tool.name}`,
      url: `/tools/${tool.slug}`,
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 pt-12 pb-24 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted">
        <Link href="/" className="hover:text-phosphor">
          radar
        </Link>
        {" / "}
        <span className="text-starlight">territory</span>
      </nav>

      <p className="eyebrow mt-10">semantic territory</p>
      <h1 className="font-display mt-3 text-5xl text-starlight">{detail.cluster.label}</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
        {detail.cluster.size} tools gravitate here. This territory wasn&apos;t hand-made —
        it emerged from what these tools say they do. If you&apos;re choosing between
        them, you&apos;re in the right place.
      </p>

      <div className="mt-12">
        {detail.tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
      </main>
    </>
  );
}
