/* eslint-disable react/no-unknown-property */

import * as THREE from "three";
import { useCallback, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useBox, type BoxProps, type Triplet } from "@react-three/cannon";
import { useSnapshot } from "valtio";
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import YProvider from "y-partyserver/provider";

const ydoc = new Y.Doc();

// Connect to PartyServer
const roomId = window.location.hash.slice(1) || "default";
const resolvedHost = import.meta.env.PROD
  ? window.location.host
  : window.location.host;

new YProvider(resolvedHost, roomId, ydoc, {
  connect: true,
  party: "y-doc-server",
});

const { proxy: state } = createYjsProxy<{
  cubes?: [number, number, number][];
}>(ydoc, {
  getRoot: (doc: Y.Doc) => doc.getMap("map"),
});

// State is initialized server-side in onLoad

// This is a super naive implementation and wouldn't allow for more than a few thousand boxes.
// In order to make this scale this has to be one instanced mesh, then it could easily be
// hundreds of thousands.

const addCube = (x: number, y: number, z: number) => {
  const arr = state.cubes;
  if (!arr) {
    state.cubes = [[x, y, z]];
    return;
  }
  arr[arr.length] = [x, y, z];
};

const FACE_OFFSETS: readonly Triplet[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export const Cubes = () => {
  const snap = useSnapshot(state);
  const cubes = snap.cubes;
  return cubes?.map((coords, index) => {
    if (!coords) {
      return null;
    }
    const position = [
      coords[0] ?? 0,
      coords[1] ?? 0,
      coords[2] ?? 0,
    ] as Triplet;
    return <Cube key={index} position={position} />;
  });
};

type CubeProps = BoxProps & { position?: Triplet };

export const Cube = ({ position, ...rest }: CubeProps) => {
  const sanitizedPosition = useMemo<Triplet | undefined>(() => {
    if (!position) {
      return undefined;
    }
    return [position[0], position[1], position[2]] as Triplet;
  }, [position?.[0], position?.[1], position?.[2]]);

  const deps = useMemo<Triplet>(
    () => [
      sanitizedPosition?.[0] ?? 0,
      sanitizedPosition?.[1] ?? 0,
      sanitizedPosition?.[2] ?? 0,
    ],
    [sanitizedPosition?.[0], sanitizedPosition?.[1], sanitizedPosition?.[2]],
  );

  const [ref] = useBox<THREE.Mesh>(
    () => ({
      type: "Static" as const,
      ...rest,
      ...(sanitizedPosition ? { position: sanitizedPosition } : {}),
    }),
    undefined,
    deps,
  );
  const [hover, setHover] = useState<number | null>(null);
  const texture = useLoader(THREE.TextureLoader, "/dirt.jpg");
  const onMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(Math.floor(e.faceIndex! / 2));
  }, []);
  const onOut = useCallback(() => setHover(null), []);
  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const index = Math.floor(e.faceIndex! / 2);
      const offset = FACE_OFFSETS[index];
      if (!offset) {
        return;
      }
      const { x, y, z } = ref.current!.position;
      const [dx, dy, dz] = offset;
      addCube(x + dx, y + dy, z + dz);
    },
    [ref],
  );
  return (
    <mesh
      ref={ref}
      receiveShadow
      castShadow
      onPointerMove={onMove}
      onPointerOut={onOut}
      onClick={onClick}
    >
      {[...Array(6)].map((_, index) => (
        <meshStandardMaterial
          key={index}
          attach={`material-${index}`}
          map={texture}
          color={hover === index ? "hotpink" : "white"}
        />
      ))}
      <boxGeometry />
    </mesh>
  );
};
