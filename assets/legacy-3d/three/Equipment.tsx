"use client";

import { useMemo, type Ref } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

const RED = "#DC293B";

type Faces = { map: THREE.CanvasTexture; glow: THREE.CanvasTexture };

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Bumper plate / dumbbell end faces with the Play Smart mark, drawn at runtime from /brand/mark.png. */
function useFaces(): { plate: Faces; head: Faces } {
  const mark = useLoader(THREE.ImageLoader, "/brand/mark.png");
  return useMemo(() => {
    const S = 1024;
    const c = S / 2;
    const drawMark = (g: CanvasRenderingContext2D, w: number, cy: number) => {
      const h = (w * mark.height) / mark.width;
      g.drawImage(mark, c - w / 2, cy - h / 2, w, h);
    };

    // Barbell bumper plate
    const [pc, pg] = canvas(S);
    const grad = pg.createRadialGradient(c, c, 60, c, c, c);
    grad.addColorStop(0, "#1d1d1d");
    grad.addColorStop(1, "#0b0b0b");
    pg.fillStyle = grad;
    pg.fillRect(0, 0, S, S);
    pg.strokeStyle = "#1f1f1f";
    pg.lineWidth = 26;
    pg.beginPath();
    pg.arc(c, c, 486, 0, Math.PI * 2);
    pg.stroke();
    pg.strokeStyle = RED;
    pg.lineWidth = 12;
    pg.beginPath();
    pg.arc(c, c, 420, 0, Math.PI * 2);
    pg.stroke();
    pg.fillStyle = "#8f8f8f";
    pg.beginPath();
    pg.arc(c, c, 96, 0, Math.PI * 2);
    pg.fill();
    pg.fillStyle = "#050505";
    pg.beginPath();
    pg.arc(c, c, 40, 0, Math.PI * 2);
    pg.fill();
    drawMark(pg, 290, c - 225);
    pg.fillStyle = "#eaeaea";
    pg.font = "800 58px Arial, sans-serif";
    pg.textAlign = "center";
    pg.textBaseline = "middle";
    pg.letterSpacing = "10px";
    pg.fillText("PLAY SMART", c, c + 200);
    pg.fillStyle = RED;
    pg.font = "700 40px Arial, sans-serif";
    pg.fillText("20 KG", c, c + 268);

    const [pgc, pgg] = canvas(512);
    pgg.scale(0.5, 0.5);
    pgg.strokeStyle = RED;
    pgg.lineWidth = 12;
    pgg.beginPath();
    pgg.arc(c, c, 420, 0, Math.PI * 2);
    pgg.stroke();
    drawMark(pgg, 290, c - 225);

    // Dumbbell head: the mark fills the face.
    const [hc, hg] = canvas(S);
    hg.fillStyle = "#0d0d0d";
    hg.fillRect(0, 0, S, S);
    hg.strokeStyle = RED;
    hg.lineWidth = 22;
    hg.beginPath();
    hg.arc(c, c, 455, 0, Math.PI * 2);
    hg.stroke();
    drawMark(hg, 620, c);
    const [hgc, hgg] = canvas(512);
    hgg.scale(0.5, 0.5);
    hgg.strokeStyle = RED;
    hgg.lineWidth = 22;
    hgg.beginPath();
    hgg.arc(c, c, 455, 0, Math.PI * 2);
    hgg.stroke();
    drawMark(hgg, 620, c);

    return {
      plate: { map: tex(pc), glow: tex(pgc) },
      head: { map: tex(hc), glow: tex(hgc) },
    };
  }, [mark]);
}

function useMaterials() {
  const faces = useFaces();
  return useMemo(() => {
    const chrome = new THREE.MeshStandardMaterial({ color: "#c9c9c9", metalness: 1, roughness: 0.22 });
    const knurl = new THREE.MeshStandardMaterial({ color: "#8d8d8d", metalness: 1, roughness: 0.48 });
    const rubber = new THREE.MeshStandardMaterial({ color: "#121212", metalness: 0.05, roughness: 0.72 });
    const face = (f: Faces) =>
      new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.55, roughness: 0.62, metalness: 0.08 });
    return { chrome, knurl, rubber, plateFace: face(faces.plate), headFace: face(faces.head) };
  }, [faces]);
}

/** Cylinder along X whose end caps get `cap` (top cap faces -X before the side flip). */
function Disc({ r, w, x, side, mats }: { r: number; w: number; x: number; side: 1 | -1; mats: THREE.Material[] }) {
  // Top cap of a Y-up cylinder faces +X after rotating -90° about Z, -X after +90°.
  // The +X side also spins half a turn about its own axis so the artwork reads upright on both ends.
  return (
    <group position-x={x} rotation-z={side === 1 ? -Math.PI / 2 : Math.PI / 2}>
      <mesh rotation-y={side === 1 ? Math.PI : 0} material={mats} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, w, 72]} />
      </mesh>
    </group>
  );
}

export function Dumbbell({ ref }: { ref?: Ref<THREE.Group> }) {
  const m = useMaterials();
  const handle = 0.135;
  const head = { r: 0.062, w: 0.085 };
  const capMats = [m.rubber, m.headFace, m.rubber];
  return (
    <group ref={ref} visible={false}>
      <mesh rotation-z={Math.PI / 2} material={m.knurl} castShadow>
        <cylinderGeometry args={[0.0165, 0.0165, handle + 0.02, 24]} />
      </mesh>
      {([1, -1] as const).map((s) => (
        <group key={s}>
          <mesh position-x={s * (handle / 2 + 0.006)} rotation-z={Math.PI / 2} material={m.chrome}>
            <cylinderGeometry args={[0.03, 0.03, 0.012, 32]} />
          </mesh>
          <Disc r={head.r} w={head.w} x={s * (handle / 2 + 0.012 + head.w / 2)} side={s} mats={capMats} />
        </group>
      ))}
    </group>
  );
}

/** Olympic barbell (2.2 m) along X, centred on the group origin, with `plates` bumpers per side. */
export function Barbell({ ref, plates = 2 }: { ref?: Ref<THREE.Group>; plates?: number }) {
  const m = useMaterials();
  const plate = { r: 0.225, w: 0.062 };
  const capMats = [m.rubber, m.plateFace, m.rubber];
  return (
    <group ref={ref} visible={false}>
      <mesh rotation-z={Math.PI / 2} material={m.knurl} castShadow>
        <cylinderGeometry args={[0.0145, 0.0145, 1.31, 24]} />
      </mesh>
      {([1, -1] as const).map((s) => (
        <group key={s}>
          <mesh position-x={s * 0.665} rotation-z={Math.PI / 2} material={m.chrome} castShadow>
            <cylinderGeometry args={[0.038, 0.038, 0.03, 32]} />
          </mesh>
          <mesh position-x={s * 0.9} rotation-z={Math.PI / 2} material={m.chrome} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.44, 32]} />
          </mesh>
          {Array.from({ length: plates }, (_, i) => (
            <Disc key={i} r={plate.r} w={plate.w} x={s * (0.69 + plate.w / 2 + i * (plate.w + 0.004))} side={s} mats={capMats} />
          ))}
          <mesh position-x={s * (0.7 + plates * (plate.w + 0.004) + 0.02)} rotation-z={Math.PI / 2} material={m.chrome}>
            <cylinderGeometry args={[0.04, 0.04, 0.035, 32]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export const PLATE_RADIUS = 0.225;
