import { getLandscape } from "@/lib/api";
import { buildLlmsTxt } from "@/lib/llms";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export const revalidate = 300;

export async function GET() {
  const landscape = await getLandscape();
  return new Response(buildLlmsTxt(landscape, SITE_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
