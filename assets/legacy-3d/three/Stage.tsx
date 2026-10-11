"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import Scene from "./Scene";

export default function Stage({ lite = false }: { lite?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={lite ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: 0.1, far: 40, position: [0, 1.3, 6] }}
      aria-hidden
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <EffectComposer multisampling={lite ? 0 : 4}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.62} luminanceSmoothing={0.2} />
        <Vignette offset={0.22} darkness={0.82} />
        <Noise opacity={0.045} premultiply />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
