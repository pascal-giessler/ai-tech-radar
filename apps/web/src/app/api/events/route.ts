const API_URL = process.env.API_URL ?? "http://localhost:8000";

// Next's `rewrites` buffer streaming bodies, which stalls SSE; this pass-through
// route handler pipes the upstream event stream to the browser unbuffered.
export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = await fetch(`${API_URL}/api/events`, { cache: "no-store" });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
