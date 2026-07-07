"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { clusterHue, formatStars, scoreTier } from "@/lib/format";
import type { Ring, Tool } from "@/lib/types";

const BASE_SCALE = 0.16;
const SCORE_SCALE = 0.5;

function nodeScale(tool: Tool): number {
  return BASE_SCALE + (tool.trend_score / 100) * SCORE_SCALE;
}

export function ToolNodes({
  tools,
  activeRings,
  selectedSlug,
  onSelect,
}: {
  tools: Tool[];
  activeRings: Set<Ring>;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const isDimmed = (tool: Tool) =>
    activeRings.size > 0 && !(tool.ring && activeRings.has(tool.ring as Ring));

  const colors = useMemo(() => {
    const array = new Float32Array(tools.length * 3);
    const color = new THREE.Color();
    tools.forEach((tool, i) => {
      const hue = tool.cluster_id !== null ? clusterHue(tool.cluster_id) : 220;
      const dim = activeRings.size > 0 && !(tool.ring && activeRings.has(tool.ring as Ring));
      const light = tool.cluster_id === 0 ? 0.32 : 0.52;
      color.setHSL(hue / 360, dim ? 0.15 : 0.72, dim ? 0.22 : light);
      color.toArray(array, i * 3);
    });
    return array;
  }, [tools, activeRings]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const time = clock.elapsedTime;
    tools.forEach((tool, i) => {
      const p = tool.position!;
      let scale = nodeScale(tool);
      if (scoreTier(tool.trend_score) === "blazing") {
        scale *= 1 + 0.12 * Math.sin(time * 2.2 + i); // blazing tools breathe
      }
      if (isDimmed(tool)) scale *= 0.4; // filtered-out rings recede
      if (tool.slug === selectedSlug || i === hovered) scale *= 1.6;
      matrix.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const hoveredTool = hovered !== null ? tools[hovered] : null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, tools.length]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(e.instanceId ?? null);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(null);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onSelect(tools[e.instanceId].slug);
        }}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          roughness={0.25}
          metalness={0.1}
          emissive="#aab6ff"
          emissiveIntensity={0.22}
          toneMapped={false}
        />
      </instancedMesh>

      {hoveredTool && hoveredTool.position && (
        <Html
          position={[hoveredTool.position.x, hoveredTool.position.y + 0.9, hoveredTool.position.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="w-max max-w-[260px] rounded border border-hairline bg-dome/90 px-3 py-2 backdrop-blur">
            <div className="font-mono text-[10px] tracking-[0.18em] text-phosphor uppercase">
              {hoveredTool.position.x.toFixed(1)} / {hoveredTool.position.y.toFixed(1)} /{" "}
              {hoveredTool.position.z.toFixed(1)}
            </div>
            <div className="mt-1 text-sm font-medium text-starlight">
              {hoveredTool.owner}/{hoveredTool.name}
            </div>
            <div className="font-mono text-xs text-muted">
              ★ {formatStars(hoveredTool.stars)} · {scoreTier(hoveredTool.trend_score)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
