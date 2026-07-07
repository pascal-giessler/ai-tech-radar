import type { Cluster, ClusterDetail, LandscapeData, Tool, ToolDetail } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

const EMPTY_LANDSCAPE: LandscapeData = {
  tools: [],
  clusters: [],
  generated_at: new Date(0).toISOString(),
};

/** Never throws: the page must render even while the radar warms up. */
export async function getLandscape(): Promise<LandscapeData> {
  try {
    return await get<LandscapeData>("/api/landscape");
  } catch {
    return EMPTY_LANDSCAPE;
  }
}

export function getTool(slug: string): Promise<ToolDetail | null> {
  return getOrNull<ToolDetail>(`/api/tools/${encodeURIComponent(slug)}`);
}

export function getTools(limit = 200): Promise<Tool[]> {
  return get<Tool[]>(`/api/tools?limit=${limit}`);
}

export function getClusters(): Promise<Cluster[]> {
  return get<Cluster[]>("/api/clusters");
}

export function getCluster(slug: string): Promise<ClusterDetail | null> {
  return getOrNull<ClusterDetail>(`/api/clusters/${encodeURIComponent(slug)}`);
}
