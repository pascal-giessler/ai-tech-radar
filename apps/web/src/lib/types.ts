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
  open_issues: number;
  /** Weekly commit counts, most-recent-last, up to ~12 weeks. Empty when unavailable. */
  commit_activity: number[];
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
  /** Top c-TF-IDF terms that characterise the cluster. */
  keywords: string[];
  /** Templated, deterministic explanation of what the cluster is and how it formed. */
  description: string;
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

/* ---------- configuration ---------- */

export interface PresetOption {
  slug: string;
  title: string;
}

export interface PipelineInfo {
  embedding_model: string;
  embedding_dim: number;
  reduce_to: number;
  algorithm: string;
  labeler: string;
}

export interface RadarSettings {
  area_preset: string;
  min_cluster_size: number;
  min_tools: number;
  presets: PresetOption[];
  pipeline: PipelineInfo;
}

export type RadarSettingsPatch = Partial<Pick<RadarSettings, "area_preset" | "min_cluster_size" | "min_tools">>;
