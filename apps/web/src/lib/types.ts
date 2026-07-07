export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export type Ring = "adopt" | "trial" | "assess" | "hold";

export interface Tool {
  slug: string;
  name: string;
  owner: string;
  description: string;
  language: string | null;
  topics: string[];
  stars: number;
  stars_gained: number;
  trend_score: number;
  ring: Ring | null;
  url: string;
  position: Position3D | null;
  cluster_id: number | null;
}

export interface ToolDetail extends Tool {
  first_seen_at: string;
  repo_created_at: string;
  last_updated_at: string;
}

export interface Cluster {
  id: number;
  label: string;
  slug: string;
  size: number;
  centroid: Position3D;
}

export interface LandscapeData {
  tools: Tool[];
  clusters: Cluster[];
  generated_at: string;
}

export interface ClusterDetail {
  cluster: Cluster;
  tools: Tool[];
}
