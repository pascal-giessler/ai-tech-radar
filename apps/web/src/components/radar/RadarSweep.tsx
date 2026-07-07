"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SWEEP_SPEED = 0.22; // radians per second — a slow, patient instrument

/**
 * The signature element: a translucent radar sweep rotating over the polar grid.
 * Vertex-colored so the wedge fades out behind its leading edge.
 */
export function RadarSweep({ radius, y }: { radius: number; y: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(radius, 48, 0, Math.PI / 3);
    const position = geo.getAttribute("position");
    const alphas: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const angle = Math.atan2(position.getY(i), position.getX(i));
      const t = angle / (Math.PI / 3); // 0 at trailing edge → 1 at leading edge
      alphas.push(Math.max(0, t) ** 2);
    }
    geo.setAttribute("alpha", new THREE.Float32BufferAttribute(alphas, 1));
    return geo;
  }, [radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color("#54e0c7") } },
        vertexShader: /* glsl */ `
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(uColor, vAlpha * 0.16);
          }
        `,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y -= delta * SWEEP_SPEED;
  });

  return (
    <group ref={groupRef} position={[0, y, 0]}>
      <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}
