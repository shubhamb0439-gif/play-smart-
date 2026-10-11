import * as THREE from "three";
import { CUT1, CUT2, REPS, SEG, local } from "@/config/timeline";
import { rep, smooth } from "./poses";

export type Exercise = "curl" | "squat" | "deadlift";

type Shot = { pos: [number, number, number]; target: [number, number, number]; frameX: number; fov: number };

/** Each exercise is filmed as a slow move from shot A to shot B. Character stands at the origin facing +Z. */
const SHOTS: Record<"hero" | Exercise, [Shot, Shot]> = {
  hero: [
    { pos: [0.2, 1.3, 7.2], target: [0, 1.0, 0], frameX: 0.2, fov: 30 },
    { pos: [-0.9, 1.42, 4.2], target: [-0.05, 1.1, 0], frameX: 0.22, fov: 30 },
  ],
  curl: [
    { pos: [-1.55, 1.5, 3.0], target: [-0.15, 1.12, 0.1], frameX: 0.22, fov: 30 },
    { pos: [-2.15, 1.32, 2.15], target: [-0.18, 1.16, 0.1], frameX: 0.22, fov: 30 },
  ],
  squat: [
    { pos: [3.4, 1.25, 3.2], target: [0, 0.92, 0], frameX: -0.22, fov: 30 },
    { pos: [4.0, 1.0, 1.5], target: [0, 0.82, -0.05], frameX: -0.22, fov: 30 },
  ],
  deadlift: [
    { pos: [-1.3, 0.42, 3.6], target: [0, 0.82, 0], frameX: 0.2, fov: 32 },
    { pos: [-2.4, 0.6, 2.6], target: [0, 0.9, 0], frameX: 0.2, fov: 32 },
  ],
};

const DEBUG_CAMS: Record<string, Shot> = {
  front: { pos: [0, 1.0, 4.6], target: [0, 0.9, 0], frameX: 0, fov: 30 },
  side: { pos: [4.6, 1.0, 0], target: [0, 0.9, 0], frameX: 0, fov: 30 },
  right: { pos: [-4.6, 1.0, 0], target: [0, 0.9, 0], frameX: 0, fov: 30 },
  back: { pos: [0, 1.2, -4.6], target: [0, 0.9, 0], frameX: 0, fov: 30 },
  three: { pos: [-3.0, 1.4, 3.4], target: [0, 0.9, 0], frameX: 0, fov: 30 },
  rclose: { pos: [-2.8, 1.25, 0.2], target: [0, 1.15, 0], frameX: 0, fov: 30 },
  fist: { pos: [-0.95, 1.3, 0.75], target: [-0.3, 1.08, 0.3], frameX: 0, fov: 30 },
  hand: { pos: [-1.9, 1.45, 1.9], target: [-0.2, 1.15, 0], frameX: 0, fov: 30 },
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function mix(a: Shot, b: Shot, t: number, out: { pos: THREE.Vector3; target: THREE.Vector3; frameX: number; fov: number }) {
  const e = smooth(t);
  out.pos.copy(tmpA.fromArray(a.pos)).lerp(tmpB.fromArray(b.pos), e);
  out.target.copy(tmpA.fromArray(a.target)).lerp(tmpB.fromArray(b.target), e);
  out.frameX = THREE.MathUtils.lerp(a.frameX, b.frameX, e);
  out.fov = THREE.MathUtils.lerp(a.fov, b.fov, e);
  return out;
}

export type Frame = {
  exercise: Exercise;
  /** Exercise effort 0..1 (curl height, squat depth, deadlift height). */
  amount: number;
  /** Which rep (0-based) and how far through it, for the HUD. */
  rep: number;
  cam: { pos: THREE.Vector3; target: THREE.Vector3; frameX: number; fov: number };
};

/** Everything the scene needs for a given scroll progress. */
export function frameAt(p: number, out: Frame, debugCam?: string | null): Frame {
  const cam = out.cam;
  if (p < CUT1) {
    out.exercise = "curl";
    const u = local(p, SEG.curl);
    out.amount = p < SEG.curl[0] || p > SEG.curl[1] ? 0 : rep(u * REPS, [0.1, 0.42], [0.55, 0.92]);
    out.rep = Math.min(REPS - 1, Math.floor(u * REPS));
    if (p < SEG.curl[0]) mix(SHOTS.hero[0], SHOTS.hero[1], local(p, SEG.hero), cam);
    else mix(SHOTS.curl[0], SHOTS.curl[1], local(p, [SEG.curl[0], CUT1]), cam);
  } else if (p < CUT2) {
    out.exercise = "squat";
    const u = local(p, SEG.squat);
    out.amount = p < SEG.squat[0] || p > SEG.squat[1] ? 0 : rep(u * REPS, [0.08, 0.45], [0.56, 0.9]);
    out.rep = Math.min(REPS - 1, Math.floor(u * REPS));
    mix(SHOTS.squat[0], SHOTS.squat[1], local(p, [CUT1, CUT2]), cam);
  } else {
    out.exercise = "deadlift";
    const u = local(p, SEG.deadlift);
    out.amount = p > SEG.deadlift[1] ? smooth(local(p, [SEG.outro[0], SEG.outro[0] + 0.04])) : p < SEG.deadlift[0] ? 0 : rep(u * REPS, [0.1, 0.45], [0.56, 0.9]);
    out.rep = Math.min(REPS - 1, Math.floor(u * REPS));
    mix(SHOTS.deadlift[0], SHOTS.deadlift[1], local(p, [CUT2, SEG.outro[1]]), cam);
  }
  if (debugCam && DEBUG_CAMS[debugCam]) mix(DEBUG_CAMS[debugCam], DEBUG_CAMS[debugCam], 0, cam);
  return out;
}

export const newFrame = (): Frame => ({
  exercise: "curl",
  amount: 0,
  rep: 0,
  cam: { pos: new THREE.Vector3(), target: new THREE.Vector3(), frameX: 0, fov: 30 },
});
