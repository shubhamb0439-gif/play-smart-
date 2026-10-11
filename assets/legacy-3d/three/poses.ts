import * as THREE from "three";
import { Rig, SIDES, sideSign, twoBone, type Side } from "./rig";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0);
const Y = V(0, 1, 0);
const lerp = THREE.MathUtils.lerp;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smooth = (t: number) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
/** Spine direction for a forward lean of `a` radians (rotation about +X). */
const pitchDir = (a: number) => V(0, Math.cos(a), Math.sin(a));
/** Front of the body for the same lean. */
const pitchFront = (a: number) => V(0, -Math.sin(a), Math.cos(a));

/** Rotate unit vector `a` about `axis`-perpendicular plane towards `b` by fraction t (both projected ⊥ axis). */
function mixAround(axis: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const pa = a.clone().addScaledVector(axis, -a.dot(axis)).normalize();
  const pb = b.clone().addScaledVector(axis, -b.dot(axis)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(pa, pb);
  return pa.applyQuaternion(new THREE.Quaternion().slerp(q, t));
}

/** Rep timeline: hold, move, pause, return, hold. Returns 0..1..0 effort for one rep. */
export function rep(u: number, up: [number, number], down: [number, number]) {
  u = ((u % 1) + 1) % 1;
  if (u < up[0]) return 0;
  if (u < up[1]) return easeInOut((u - up[0]) / (up[1] - up[0]));
  if (u < down[0]) return 1;
  if (u < down[1]) return 1 - easeInOut((u - down[0]) / (down[1] - down[0]));
  return 0;
}
function easeInOut(t: number) {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type PoseResult = {
  /** World matrix for the dumbbell (handle along local X), or null when not held. */
  dumbbell: THREE.Matrix4 | null;
  /** Barbell centre (bar along world X), or null. */
  barbell: THREE.Vector3 | null;
};

type Stance = { half: number; toeOut: number; kneeOut: number; z?: number };

export class Poser {
  readonly rig: Rig;
  private hipsBind: THREE.Vector3;
  private ankle: Record<Side, THREE.Vector3>;
  private footDir: Record<Side, THREE.Vector3>;
  private shoulderBind: THREE.Vector3;
  private l: { thigh: number; shin: number; upper: number; fore: number; hand: number };
  /** How far the handle sits from the wrist (along the hand) and off the palm. */
  private gripFwd: number;
  private gripPalm: number;
  private lockoutGripY: number;
  /** Natural forward pitch of each spine bone in the bind pose; leans are added on top. */
  private bindPitch: Record<string, number> = {};

  constructor(rig: Rig) {
    this.rig = rig;
    for (const n of ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"]) {
      const d = rig.bind[n].dir;
      this.bindPitch[n] = Math.atan2(d.z, d.y);
    }
    this.hipsBind = rig.pos("Hips");
    this.ankle = { Left: rig.pos("LeftFoot"), Right: rig.pos("RightFoot") };
    this.footDir = { Left: rig.bind.LeftFoot.dir.clone(), Right: rig.bind.RightFoot.dir.clone() };
    this.shoulderBind = rig.pos("LeftArm");
    this.l = {
      thigh: rig.len("LeftUpLeg"),
      shin: rig.len("LeftLeg"),
      upper: rig.len("LeftArm"),
      fore: rig.len("LeftForeArm"),
      hand: rig.len("LeftHand"),
    };
    this.gripFwd = this.l.hand * 0.98;
    this.gripPalm = 0.03 * (this.hipsBind.y / 0.98);
    this.lockoutGripY = this.shoulderBind.y - (this.l.upper + this.l.fore) * 0.99 - this.gripFwd;
  }

  /** Character height-ish scale relative to a 1.8 m reference, for tuning constants. */
  get k() {
    return this.hipsBind.y / 0.98;
  }

  // ---------------------------------------------------------------- body parts

  private torso(hips: THREE.Vector3, lean: number, o: { pelvis?: number; neck?: number; head?: number; chest?: number; retract?: number } = {}) {
    const r = this.rig;
    r.placeHips(hips);
    const pelvis = o.pelvis ?? lean;
    const chest = lean + (o.chest ?? 0);
    const neck = o.neck ?? lean * 0.6;
    const head = o.head ?? lean * 0.35;
    const bend: [string, number][] = [
      ["Hips", pelvis],
      ["Spine", lerp(pelvis, lean, 0.6)],
      ["Spine1", lean],
      ["Spine2", chest],
      ["Neck", neck],
      ["Head", head],
    ];
    for (const [n, a] of bend) {
      const total = this.bindPitch[n] + a;
      r.aim(n, pitchDir(total), pitchFront(total));
    }
    // Clavicles ride with the chest; `retract` pulls the shoulder blades back.
    const rot = new THREE.Quaternion().setFromAxisAngle(X, chest);
    for (const s of SIDES) {
      const b = r.bind[`${s}Shoulder`];
      const d = b.dir.clone().applyQuaternion(rot);
      if (o.retract) d.applyAxisAngle(Y, -sideSign(s) * o.retract);
      r.aim(`${s}Shoulder`, d, b.up.clone().applyQuaternion(rot));
    }
  }

  /** Lowest the hips must drop so both legs can reach their ankles. */
  private reachDrop(st: Stance) {
    let drop = 0;
    const reach = (this.l.thigh + this.l.shin) * 0.985;
    for (const s of SIDES) {
      const a = this.rig.pos(`${s}UpLeg`);
      const t = this.ankleTarget(s, st);
      const dxz = Math.hypot(a.x - t.x, a.z - t.z);
      if (dxz >= reach) continue;
      const maxY = t.y + Math.sqrt(reach * reach - dxz * dxz);
      drop = Math.max(drop, a.y - maxY);
    }
    return drop;
  }

  private ankleTarget(s: Side, st: Stance) {
    const b = this.ankle[s];
    return V(sideSign(s) * st.half * this.k, b.y, (st.z ?? b.z));
  }

  private legs(st: Stance) {
    const r = this.rig;
    for (const s of SIDES) {
      const sg = sideSign(s);
      const turn = new THREE.Quaternion().setFromAxisAngle(Y, sg * st.toeOut);
      const pole = V(sg * st.kneeOut, 0, 1).normalize().applyQuaternion(turn);
      const ik = twoBone(r.pos(`${s}UpLeg`), this.ankleTarget(s, st), this.l.thigh, this.l.shin, pole);
      r.aim(`${s}UpLeg`, ik.d1, pole);
      r.aim(`${s}Leg`, ik.d2, pole);
      const foot = this.footDir[s].clone().applyQuaternion(turn);
      r.aim(`${s}Foot`, foot, Y);
      r.aim(`${s}ToeBase`, V(foot.x, 0, foot.z).normalize(), Y);
    }
  }

  private palm(s: Side, dir: THREE.Vector3, thumb: THREE.Vector3) {
    return s === "Left" ? dir.clone().cross(thumb).normalize() : thumb.clone().cross(dir).normalize();
  }

  /** Aim the hand and wrap the finger chain around a handle. */
  private hand(s: Side, dir: THREE.Vector3, thumb: THREE.Vector3, wrap = 1) {
    const r = this.rig;
    const t = thumb.clone().addScaledVector(dir, -thumb.dot(dir)).normalize();
    const palm = this.palm(s, dir, t);
    r.aim(`${s}Hand`, dir, t);
    const angles = [1.45, 2.55, 3.25].map((a) => a * wrap);
    ["HandIndex1", "HandIndex2", "HandIndex3"].forEach((f, i) => {
      const d = dir.clone().multiplyScalar(Math.cos(angles[i])).addScaledVector(palm, Math.sin(angles[i]));
      r.aim(`${s}${f}`, d, t);
    });
    return { thumb: t, palm };
  }

  /** Upper arm + forearm along given directions, twist split between forearm and hand. */
  private armFK(s: Side, upper: THREE.Vector3, fore: THREE.Vector3, thumb: THREE.Vector3, fallbackCrease: THREE.Vector3) {
    const r = this.rig;
    let crease = fore.clone().addScaledVector(upper, -fore.dot(upper));
    if (crease.lengthSq() < 0.02) crease = fallbackCrease.clone();
    crease.normalize();
    r.aim(`${s}Arm`, upper, crease);
    r.aim(`${s}ForeArm`, fore, mixAround(fore, crease, thumb, 0.45));
  }

  private armTo(s: Side, wrist: THREE.Vector3, pole: THREE.Vector3, thumb: THREE.Vector3, fallbackCrease: THREE.Vector3) {
    const ik = twoBone(this.rig.pos(`${s}Arm`), wrist, this.l.upper, this.l.fore, pole);
    this.armFK(s, ik.d1, ik.d2, thumb, fallbackCrease);
    return ik;
  }

  /** Relaxed hanging arm, palm facing the thigh. */
  private hang(s: Side, spread = 0.14, bend = 0.2) {
    const sg = sideSign(s);
    const upper = V(sg * spread, -1, 0.02).normalize();
    const fore = upper.clone().applyAxisAngle(X, -bend).normalize();
    const thumb = V(0, 0, 1);
    this.armFK(s, upper, fore, thumb, V(0, 0, 1));
    this.hand(s, fore.clone().applyAxisAngle(X, -0.1), thumb, 0.35);
  }

  private gripPoint(s: Side) {
    const r = this.rig;
    const w = r.pos(`${s}Hand`);
    const dir = r.pos(`${s}HandIndex1`).sub(w).normalize();
    const hq = r.bones[`${s}Hand`].getWorldQuaternion(new THREE.Quaternion());
    // Thumb axis of the hand in world space, recovered from the bind convention.
    const thumb = r.bind[`${s}Hand`].up.clone().applyQuaternion(hq.multiply(r.bind[`${s}Hand`].worldQ.clone().invert()));
    const palm = this.palm(s, dir, thumb.addScaledVector(dir, -thumb.dot(dir)).normalize());
    return w.addScaledVector(dir, this.gripFwd).addScaledVector(palm, this.gripPalm);
  }

  // ---------------------------------------------------------------- exercises

  private breathe(time: number) {
    return Math.sin(time * 1.6) * 0.012;
  }

  /** Standing with a dumbbell in the right hand. c: 0 = arm down, 1 = top of the curl. */
  curl(c: number, time: number): PoseResult {
    const r = this.rig;
    r.reset();
    const st: Stance = { half: 0.12, toeOut: 0.18, kneeOut: 0.12 };
    const lean = 0.03 - 0.03 * c;
    const hips = this.hipsBind.clone();
    hips.y += Math.sin(time * 1.6) * 0.003;
    this.torso(hips, lean, { chest: this.breathe(time) - 0.02 * c, neck: 0.04, head: 0.06 + 0.03 * c });
    hips.y -= this.reachDrop(st) + 0.01;
    this.torso(hips, lean, { chest: this.breathe(time) - 0.02 * c, neck: 0.04, head: 0.06 + 0.03 * c });
    this.legs(st);

    // Working arm: elbow pinned at the side, drifting slightly forward at the top.
    const upper = V(-0.16, -1, 0.04 + 0.2 * c).normalize();
    const crease = V(0.18, 0, 1);
    crease.addScaledVector(upper, -crease.dot(upper)).normalize();
    const theta = lerp(0.14, 2.05, c);
    const fore = upper.clone().multiplyScalar(Math.cos(theta)).addScaledVector(crease, Math.sin(theta)).normalize();
    const thumb = V(-1, 0, 0.1).normalize();
    this.armFK("Right", upper, fore, thumb, crease);
    const palm0 = this.palm("Right", fore, thumb.clone().addScaledVector(fore, -thumb.dot(fore)).normalize());
    const wrist = lerp(0.05, 0.28, c);
    const handDir = fore.clone().multiplyScalar(Math.cos(wrist)).addScaledVector(palm0, Math.sin(wrist)).normalize();
    const h = this.hand("Right", handDir, thumb);

    this.hang("Left", 0.16, 0.22 + 0.05 * Math.sin(time * 1.6));

    const center = r.pos("RightHand").addScaledVector(handDir, this.gripFwd).addScaledVector(h.palm, this.gripPalm);
    const m = new THREE.Matrix4().makeBasis(h.thumb, handDir.clone().negate(), h.thumb.clone().cross(handDir.clone().negate()));
    m.setPosition(center);
    return { dumbbell: m, barbell: null };
  }

  /** High-bar back squat. s: 0 = standing, 1 = bottom (thighs a touch below parallel). */
  squat(s: number, time: number): PoseResult {
    const r = this.rig;
    r.reset();
    const k = this.k;
    const st: Stance = { half: 0.2, toeOut: 0.42, kneeOut: 0.3 };
    const e = smooth(s);
    const lean = lerp(0.14, 0.68, e);
    const opts = { pelvis: lean * 0.9, chest: -0.08 + this.breathe(time) * (1 - e), neck: lean * 0.4, head: lean * 0.12, retract: 0.18 };
    const bottomY = this.ankle.Left.y + this.l.shin * 0.8 + 0.1 * k;
    const midfootZ = this.ankle.Left.z + 0.05 * k;
    const hips = V(0, lerp(this.hipsBind.y, bottomY, e), lerp(0, -0.2 * k, e));

    let bar = V();
    const placeBar = () => {
      const chestA = lean + opts.chest;
      return r.pos("Neck").addScaledVector(pitchFront(chestA), -0.11 * k).addScaledVector(pitchDir(chestA), -0.04 * k);
    };
    for (let i = 0; i < 4; i++) {
      this.torso(hips, lean, opts);
      if (i === 0) {
        hips.y -= this.reachDrop(st);
        this.torso(hips, lean, opts);
      }
      bar = placeBar();
      hips.z -= bar.z - midfootZ;
    }
    this.torso(hips, lean, opts);
    bar = placeBar();
    this.legs(st);

    const chestA = lean + opts.chest;
    for (const side of SIDES) {
      const sg = sideSign(side);
      const grip = bar.clone().add(V(sg * 0.47 * k, 0, 0));
      const handDir = pitchDir(chestA - 0.25);
      const thumb = V(-sg, 0, 0);
      const palm = this.palm(side, handDir, thumb);
      const wrist = grip.clone().addScaledVector(handDir, -this.gripFwd).addScaledVector(palm, -this.gripPalm);
      this.armTo(side, wrist, V(sg * 0.5, -1, -0.45).normalize(), thumb, V(0, 0, 1));
      this.hand(side, handDir, thumb);
    }
    return { dumbbell: null, barbell: bar };
  }

  /**
   * Conventional deadlift. s: 0 = bar on the floor (set-up), 1 = lockout.
   * Knees extend first, then the hips drive through; the bar path stays over mid-foot.
   */
  deadlift(s: number, time: number, plateRadius: number): PoseResult {
    const r = this.rig;
    r.reset();
    const k = this.k;
    const st: Stance = { half: 0.14, toeOut: 0.16, kneeOut: 0.12 };
    const a0 = 1.02;
    const lean = s < 0.4 ? a0 * (1 - 0.12 * (s / 0.4)) : a0 * 0.88 * (1 - smooth((s - 0.4) / 0.6)) - 0.04 * smooth((s - 0.85) / 0.15);
    const opts = { pelvis: lean * 0.95, chest: -0.04 + this.breathe(time) * s, neck: lean * 0.72, head: lean * 0.5, retract: lerp(0, 0.16, s) };
    const barY = lerp(plateRadius, this.lockoutGripY, smooth(s));
    const midfootZ = this.ankle.Left.z + 0.05 * k;

    const hang = (side: Side) => V(sideSign(side) * 0.09, -1, -0.02).normalize();
    const handDir = V(0, -1, 0);
    const reach = (this.l.upper + this.l.fore) * 0.995;
    const gripOf = (side: Side) => {
      const sg = sideSign(side);
      const wrist = r.pos(`${side}Arm`).addScaledVector(hang(side), reach);
      const thumb = V(-sg, 0, 0);
      return wrist.addScaledVector(handDir, this.gripFwd).addScaledVector(this.palm(side, handDir, thumb), this.gripPalm);
    };

    const hips = V(0, lerp(0.7 * k, this.hipsBind.y, s), lerp(-0.3 * k, 0, s));
    for (let i = 0; i < 5; i++) {
      this.torso(hips, lean, opts);
      const g = gripOf("Left").add(gripOf("Right")).multiplyScalar(0.5);
      hips.y -= g.y - barY;
      hips.z -= g.z - midfootZ;
    }
    this.torso(hips, lean, opts);
    const drop = this.reachDrop(st);
    if (drop > 0) {
      hips.y -= drop;
      this.torso(hips, lean, opts);
    }
    this.legs(st);

    for (const side of SIDES) {
      const sg = sideSign(side);
      const thumb = V(-sg, 0, 0);
      const up = hang(side);
      const crease = V(-sg * 0.7, 0, 1).normalize();
      this.armFK(side, up, up.clone().applyAxisAngle(X, -0.04), thumb, crease);
      this.hand(side, handDir, thumb);
    }
    const bar = this.gripPoint("Left").add(this.gripPoint("Right")).multiplyScalar(0.5);
    return { dumbbell: null, barbell: bar };
  }
}
