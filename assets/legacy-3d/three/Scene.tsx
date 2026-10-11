"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { CUT1, CUT2 } from "@/config/timeline";
import { exp, markReady } from "@/lib/experienceStore";
import { Rig } from "./rig";
import { Poser } from "./poses";
import { Barbell, Dumbbell, PLATE_RADIUS } from "./Equipment";
import { frameAt, newFrame } from "./shots";

const MODEL = "/models/mannequin.glb";
const HEIGHT = 1.8;
const RED = new THREE.Color("#ff1f35");
/** Joints drawn as dots when a debug camera is active (?cam=...). */
const MARKED = ["RightHand", "RightHandIndex1", "RightHandIndex2", "RightHandIndex3", "RightForeArm", "LeftHand", "LeftHandIndex1", "LeftHandIndex2", "LeftHandIndex3"];

/** Grey clay skin with a red Fresnel edge, so the silhouette always catches a little red. */
function makeSkin(map: THREE.Texture | null, rim: { value: number }) {
  const mat = new THREE.MeshStandardMaterial({ map, color: "#bdbdbd", roughness: 0.52, metalness: 0.04 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim;
    shader.uniforms.uRimColor = { value: RED };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.2);
        totalEmissiveRadiance += uRimColor * fres * uRim;`,
      );
  };
  return mat;
}

/** Shader uniform with a setter, so per-frame updates stay out of React's immutability rules. */
class Uniform {
  constructor(public value: number) {}
  set(v: number) {
    this.value = v;
  }
}

function Mannequin() {
  const { scene } = useGLTF(MODEL);
  const dumbbell = useRef<THREE.Group>(null);
  const squatBar = useRef<THREE.Group>(null);
  const deadBar = useRef<THREE.Group>(null);
  const markers = useRef<THREE.Group>(null);
  const lightRig = useRef<{ update: (camPos: THREE.Vector3, intro: number, t: number) => void } | null>(null);
  /** Per-frame mutable state lives in one ref so render stays pure. */
  const live = useRef({ frame: newFrame(), smoothP: 0 });

  const { poser, rim } = useMemo(() => {
    const rim = new Uniform(0);
    scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // bones move far from the bind-pose bounds
        mesh.material = makeSkin((mesh.material as THREE.MeshStandardMaterial).map, rim);
      }
    });
    // Mixamo exported in tiny units; normalise to a 1.8 m athlete standing on y = 0.
    scene.scale.setScalar(1);
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    scene.scale.setScalar(HEIGHT / (box.max.y - box.min.y));
    scene.updateMatrixWorld(true);
    box.setFromObject(scene, true);
    scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    scene.updateMatrixWorld(true);
    return { poser: new Poser(new Rig(scene)), rim };
  }, [scene]);

  useEffect(() => markReady(), []);

  useFrame((state, dt) => {
    const target = exp.debugP ?? exp.p;
    // Damp the scroll, but never let the damped value sit on the other side of a cut than the real one.
    const L = live.current;
    let sp = L.smoothP + (target - L.smoothP) * (1 - Math.exp(-dt * 9));
    for (const cut of [CUT1, CUT2]) if (target >= cut !== sp >= cut) sp = target;
    L.smoothP = sp;

    const t = state.clock.elapsedTime;
    const f = frameAt(sp, L.frame, exp.debugCam);
    const res =
      f.exercise === "curl" ? poser.curl(f.amount, t) : f.exercise === "squat" ? poser.squat(f.amount, t) : poser.deadlift(f.amount, t, PLATE_RADIUS);

    if (dumbbell.current) {
      dumbbell.current.visible = !!res.dumbbell;
      if (res.dumbbell) res.dumbbell.decompose(dumbbell.current.position, dumbbell.current.quaternion, dumbbell.current.scale);
    }
    for (const [ref, ex] of [
      [squatBar, "squat"],
      [deadBar, "deadlift"],
    ] as const) {
      const g = ref.current;
      if (!g) continue;
      g.visible = f.exercise === ex && !!res.barbell;
      if (res.barbell) g.position.copy(res.barbell);
    }

    // Camera: shot + pointer parallax + intro dolly. Portrait screens back off and centre.
    const cam = state.camera as THREE.PerspectiveCamera;
    const size = state.size;
    const portrait = size.width / size.height < 0.8;
    const intro = exp.debugP != null ? 1 : exp.intro;
    const pos = f.cam.pos.clone();
    const dir = pos.clone().sub(f.cam.target);
    dir.multiplyScalar((portrait ? 1.45 : 1) + (1 - intro) * 0.35);
    pos.copy(f.cam.target).add(dir);
    if (exp.debugCam == null) {
      const right = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
      pos.addScaledVector(right, -exp.pointer.x * 0.12).add(new THREE.Vector3(0, exp.pointer.y * 0.06, 0));
    }
    cam.position.copy(pos);
    cam.lookAt(f.cam.target);
    cam.fov = f.cam.fov;
    const fx = portrait ? 0 : f.cam.frameX;
    cam.setViewOffset(size.width, size.height, -fx * size.width, 0, size.width, size.height);

    if (markers.current && exp.debugCam) {
      markers.current.visible = true;
      MARKED.forEach((n, i) => poser.rig.pos(n, markers.current!.children[i].position));
    }
    rim.set(0.55 * intro);
    lightRig.current?.update(f.cam.pos, intro, t);
  });

  return (
    <>
      <primitive object={scene} />
      <Dumbbell ref={dumbbell} />
      <Barbell ref={squatBar} plates={2} />
      <Barbell ref={deadBar} plates={3} />
      <Lights apiRef={lightRig} />
      <group ref={markers} visible={false}>
        {MARKED.map((n) => (
          <mesh key={n} renderOrder={10}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color={n.includes('Index') ? '#ffe600' : '#00ff88'} depthTest={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/**
 * Lighting follows the camera: a soft key from camera-left and two red rims always placed
 * behind the athlete relative to the lens, so every shot gets the red edge.
 */
function Lights({ apiRef }: { apiRef: React.RefObject<{ update: (c: THREE.Vector3, intro: number, t: number) => void } | null> }) {
  const key = useRef<THREE.SpotLight>(null);
  const rimL = useRef<THREE.SpotLight>(null);
  const rimR = useRef<THREE.SpotLight>(null);
  const glow = useRef<THREE.PointLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const focus = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.0, 0);
    return o;
  }, []);

  useEffect(() => {
    apiRef.current = {
      update(camPos, intro, t) {
        const az = Math.atan2(camPos.x, camPos.z);
        const at = (a: number, r: number, h: number, l: THREE.Object3D | null) => l?.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
        at(az - 0.75, 4.2, 3.6, key.current);
        at(az + Math.PI - 0.7, 3.2, 2.7, rimL.current);
        at(az + Math.PI + 0.75, 3.2, 2.2, rimR.current);
        at(az + Math.PI, 1.6, 0.25, glow.current);
        const flicker = 1 + Math.sin(t * 2.1) * 0.03;
        if (key.current) key.current.intensity = 34 * intro;
        if (rimL.current) rimL.current.intensity = 120 * intro * flicker;
        if (rimR.current) rimR.current.intensity = 75 * intro;
        if (glow.current) glow.current.intensity = 1.2 * intro;
        if (hemi.current) hemi.current.intensity = 0.25 + 0.35 * intro;
      },
    };
  }, [apiRef]);

  return (
    <>
      <primitive object={focus} />
      <hemisphereLight ref={hemi} args={["#9a9aa6", "#200508", 0.4]} />
      <spotLight
        ref={key}
        color="#f1ece6"
        angle={0.42}
        penumbra={0.9}
        decay={2}
        target={focus}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <spotLight ref={rimL} color="#ff1a2e" angle={0.55} penumbra={0.7} decay={2} target={focus} />
      <spotLight ref={rimR} color="#ff2a3c" angle={0.55} penumbra={0.8} decay={2} target={focus} />
      <pointLight ref={glow} color="#ff1a2e" distance={4} decay={2} />
    </>
  );
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        blur={[400, 120]}
        resolution={512}
        mixBlur={1}
        mixStrength={0.9}
        roughness={0.85}
        depthScale={1.1}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.3}
        color="#0b0b0c"
        metalness={0.55}
        mirror={0}
      />
    </mesh>
  );
}

export default function Scene() {
  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 6, 17]} />
      {/* Studio reflections for the chrome, built in-scene (no HDR download). */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.4} position={[0, 5, 2]} scale={[6, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={3} color="#ff2236" position={[-4, 1.5, -3]} scale={[1, 4, 1]} />
        <Lightformer intensity={2} color="#ff2236" position={[4, 1.5, -3]} scale={[1, 4, 1]} />
      </Environment>
      <Mannequin />
      <Floor />
    </>
  );
}

useGLTF.preload(MODEL);
