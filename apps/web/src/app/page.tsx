import { LandscapeIndex } from "@/components/LandscapeIndex";
import { RadarView } from "@/components/radar/RadarView";
import { getLandscape } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  const landscape = await getLandscape();

  return (
    <main>
      <h1 className="sr-only">
        AI Radar — a live semantic landscape of trending GitHub repos and AI developer tools
      </h1>
      <RadarView initial={landscape} />
      <LandscapeIndex clusters={landscape.clusters} tools={landscape.tools} />
    </main>
  );
}
