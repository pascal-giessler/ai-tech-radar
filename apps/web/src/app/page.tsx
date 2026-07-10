import { AppShellMount } from "@/components/app/AppShellMount";
import { LandscapeIndex } from "@/components/LandscapeIndex";
import { getLandscape } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  const landscape = await getLandscape();

  return (
    <main>
      <h1 className="sr-only">
        AI Radar — a living technology radar for any tech domain: trending GitHub repos plotted by
        momentum and semantic category on a live scanning radar.
      </h1>
      <AppShellMount initial={landscape} />
      <LandscapeIndex clusters={landscape.clusters} tools={landscape.tools} />
    </main>
  );
}
