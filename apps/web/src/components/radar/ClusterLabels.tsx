"use client";

import { Html } from "@react-three/drei";

import { clusterHue } from "@/lib/format";
import type { Cluster } from "@/lib/types";

export function ClusterLabels({ clusters }: { clusters: Cluster[] }) {
  return (
    <group>
      {clusters.map((cluster) => (
        <Html
          key={cluster.id}
          position={[cluster.centroid.x, cluster.centroid.y + 1.8, cluster.centroid.z]}
          center
          distanceFactor={26}
          style={{ pointerEvents: "none", userSelect: "none" }}
          zIndexRange={[10, 0]}
        >
          <div className="flex flex-col items-center whitespace-nowrap">
            <span
              className="font-display text-xl tracking-wide"
              style={{
                color: `hsl(${clusterHue(cluster.id)} 65% 72%)`,
                textShadow: "0 0 14px rgba(10,14,26,0.9)",
              }}
            >
              {cluster.label}
            </span>
            <span className="font-mono text-[9px] tracking-[0.25em] text-muted uppercase">
              {cluster.size} tools
            </span>
          </div>
        </Html>
      ))}
    </group>
  );
}
