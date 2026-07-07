"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Position3D } from "@/lib/types";

export function CameraRig({ target }: { target: Position3D | null }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const goal = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    goal.current.set(target?.x ?? 0, target?.y ?? 0, target?.z ?? 0);
    controls.target.lerp(goal.current, 0.06); // glide, don't jump
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={6}
      maxDistance={55}
      autoRotate={target === null}
      autoRotateSpeed={0.25}
      dampingFactor={0.08}
    />
  );
}
