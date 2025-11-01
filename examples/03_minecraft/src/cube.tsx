/* eslint react/no-unknown-property: "off" */

import * as THREE from 'three';
import { useCallback, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useBox } from '@react-three/cannon';
import type { BoxProps } from '@react-three/cannon';
import { useSnapshot } from 'valtio';
import * as Y from 'yjs';
import { createYjsProxy } from 'valtio-yjs';
import { WebrtcProvider } from 'y-webrtc';
// @ts-expect-error no types
import dirt from './assets/dirt.jpg';

const ydoc = new Y.Doc();

const provider = new WebrtcProvider('minecraft-valtio-yjs-demo-3', ydoc, {
  signaling: ['ws://localhost:4444'],
});

// (optional) attach provider event logs when debugging connectivity


const { proxy: state, bootstrap } = createYjsProxy<{
  cubes: [number, number, number][];
}>(ydoc, {
  getRoot: (doc: Y.Doc) => doc.getMap('map'),
});

// Initialize shared state once per room:
// - Wait for `synced` so late joiners first receive remote state.
// - Call `bootstrap` after that; it already no-ops if the root isn't empty, preventing
//   double-initialization.
provider.on('synced', () => {
  try {
    bootstrap({ cubes: [] });
  } catch (e) {
    // Ignore bootstrap errors in example
  }
});

// This is a super naive implementation and wouldn't allow for more than a few thousand boxes.
// In order to make this scale this has to be one instanced mesh, then it could easily be
// hundreds of thousands.

const addCube = (x: number, y: number, z: number) => {
  const arr = state.cubes;
  arr[arr.length] = [x, y, z];
};

export const Cubes = () => {
  const snap = useSnapshot(state, { sync: true });
  const cubes = snap.cubes;
  return cubes.map((coords, index) => {
    const pos = Array.from(coords) as [number, number, number];
    return <Cube key={index} position={pos} />;
  });
};

export const Cube = (props: BoxProps) => {
  const [ref] = useBox(() => ({ type: 'Static', ...props }));
  const [hover, setHover] = useState<number | null>(null);
  const texture = useLoader(THREE.TextureLoader, dirt);
  const onMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(Math.floor(e.faceIndex! / 2));
  }, []);
  const onOut = useCallback(() => setHover(null), []);
  const onClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const { x, y, z } = ref.current!.position;
    const dir = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ] as (readonly [number, number, number])[];
    addCube(...dir[Math.floor(e.faceIndex! / 2)]!);
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <mesh
      ref={ref as never /* FIXME proper typing */}
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
          color={hover === index ? 'hotpink' : 'white'}
        />
      ))}
      <boxGeometry />
    </mesh>
  );
};
