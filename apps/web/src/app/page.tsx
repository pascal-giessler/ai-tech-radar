import { AppShellMount } from "@/components/app/AppShellMount";
import { LandscapeIndex } from "@/components/LandscapeIndex";
import { getLandscape } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  const landscape = await getLandscape();

  return (
    <main>
      <h1 className="sr-only">
        AI Radar — the living technology radar: trending GitHub repos and AI developer tools plotted by
        momentum and category on a live scanning radar.
      </h1>
      <AppShellMount initial={landscape} />
      <LandscapeIndex clusters={landscape.clusters} tools={landscape.tools} />
    </main>
  );
}
