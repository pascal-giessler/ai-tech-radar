"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";

import type { Cluster, Tool } from "@/lib/types";

import { CameraRig } from "./CameraRig";
import { ClusterLabels } from "./ClusterLabels";
import { RadarSweep } from "./RadarSweep";
import { ToolNodes } from "./ToolNodes";

export function RadarScene({
  tools,
  clusters,
  selectedSlug,
  onSelect,
}: {
  tools: Tool[];
  clusters: Cluster[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const placed = tools.filter((t) => t.position !== null);
  const selected = placed.find((t) => t.slug === selectedSlug) ?? null;

  return (
    <Canvas
      camera={{ position: [0, 14, 30], fov: 48 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#0a0e1a"]} />
      <fog attach="fog" args={["#0a0e1a", 34, 68]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 18, 8]} intensity={0.7} color="#dfe7ff" />

      <Stars radius={90} depth={40} count={2200} factor={3} saturation={0} fade speed={0.4} />

      {/* Observatory instrument bed: polar grid under the point cloud */}
      <polarGridHelper args={[16, 12, 5, 48, 0x232b45, 0x1a2138]} position={[0, -8, 0]} />
      <RadarSweep radius={16} y={-7.95} />

      <ToolNodes tools={placed} selectedSlug={selectedSlug} onSelect={onSelect} />
      <ClusterLabels clusters={clusters} />
      <CameraRig target={selected?.position ?? null} />
    </Canvas>
  );
}
