/* eslint-disable react/no-unknown-property */

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, PointerLockControls } from "@react-three/drei";
import { Physics } from "@react-three/cannon";
import type { Triplet } from "@react-three/cannon";
import { Ground } from "./ground";
import { Player } from "./player";
import { Cube, Cubes } from "./cube";
import "./styles.css";

const CANVAS_GL = { alpha: false } as const;
const CAMERA_SETTINGS = { fov: 45 } as const;
const SUN_POSITION: [number, number, number] = [100, 20, 100];
const POINT_LIGHT_POSITION: Triplet = [100, 100, 100];
const GRAVITY: Triplet = [0, -30, 0];
const INITIAL_CUBE_POSITION: Triplet = [0, 0.5, -10];

// The original was made by Maksim Ivanow: https://www.youtube.com/watch?v=Lc2JvBXMesY&t=124s
// This demo needs pointer-lock, that works only if you open it in a new window
// Controls: WASD + left click

function InnerApp() {
  return (
    <Canvas shadows gl={CANVAS_GL} camera={CAMERA_SETTINGS}>
      <Sky sunPosition={SUN_POSITION} />
      <ambientLight intensity={1} />
      <pointLight
        castShadow
        intensity={100000}
        position={POINT_LIGHT_POSITION}
      />
      <Physics gravity={GRAVITY}>
        <Ground />
        <Player />
        <Cube position={[...INITIAL_CUBE_POSITION] as Triplet} />
        <Cubes />
      </Physics>
      <PointerLockControls />
    </Canvas>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const handleReady = useCallback(() => setIsReady(true), []);
  return (
    <>
      <InnerApp />
      <div className="dot" />
      <div
        className={`fullscreen bg ${isReady ? "ready clicked" : "notready"}`}
      >
        <div className="stack">
          <button onClick={handleReady}>Click (needs fullscreen)</button>
        </div>
      </div>
    </>
  );
}
