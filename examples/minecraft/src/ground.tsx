/* eslint-disable react/no-unknown-property */

import { useEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { usePlane } from "@react-three/cannon";
import type { Triplet } from "@react-three/cannon";

const GROUND_ROTATION: Triplet = [-Math.PI / 2, 0, 0];
const PLANE_SIZE: [number, number] = [1000, 1000];
const GROUND_TEXTURE_REPEAT: [number, number] = [240, 240];

export const Ground = () => {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: GROUND_ROTATION,
  }));
  const texture = useLoader(THREE.TextureLoader, "/grass.jpg");

  useEffect(() => {
    const [repeatX, repeatY] = GROUND_TEXTURE_REPEAT;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
  }, [texture]);

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={PLANE_SIZE} />
      <meshStandardMaterial map={texture} color="green" />
    </mesh>
  );
};
