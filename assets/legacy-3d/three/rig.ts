import * as THREE from "three";

/**
 * Procedural posing for the Mixamo-rigged mannequin.
 *
 * Every bone is driven by an absolute world-space "aim": the direction it should point
 * (towards its child joint) plus an "up" hint that fixes its twist. Up hints use the same
 * convention as the bind T-pose, so they read anatomically:
 *   spine / neck / head / hips  -> the front of the body
 *   legs                        -> the front of the knee
 *   arms, forearms, fingers     -> the thumb side (T-pose has palms down, thumbs forward)
 *   feet / toes                 -> the top of the foot
 * The character stands at the origin facing +Z with +X on its left.
 */

export type Side = "Left" | "Right";
export const SIDES: Side[] = ["Left", "Right"];
/** +1 for the character's left (+X), -1 for its right. */
export const sideSign = (s: Side) => (s === "Left" ? 1 : -1);

const CHAIN: [string, string | null][] = [
  ["Hips", "Spine"],
  ["Spine", "Spine1"],
  ["Spine1", "Spine2"],
  ["Spine2", "Neck"],
  ["Neck", "Head"],
  ["Head", null],
];
for (const s of SIDES) {
  CHAIN.push(
    [`${s}Shoulder`, `${s}Arm`],
    [`${s}Arm`, `${s}ForeArm`],
    [`${s}ForeArm`, `${s}Hand`],
    [`${s}Hand`, `${s}HandIndex1`],
    [`${s}HandIndex1`, `${s}HandIndex2`],
    [`${s}HandIndex2`, `${s}HandIndex3`],
    [`${s}HandIndex3`, null],
    [`${s}UpLeg`, `${s}Leg`],
    [`${s}Leg`, `${s}Foot`],
    [`${s}Foot`, `${s}ToeBase`],
    [`${s}ToeBase`, null],
  );
}

const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

type BindInfo = {
  worldQ: THREE.Quaternion;
  /** inverse(bind frame) * bind world quaternion; maps an aim frame to a world rotation. */
  offset: THREE.Quaternion;
  dir: THREE.Vector3;
  up: THREE.Vector3;
  length: number;
  localQ: THREE.Quaternion;
  localP: THREE.Vector3;
};

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

/** Rotation whose +Z is `dir` and whose +Y is `up` (orthogonalised). */
export function frameQuat(dir: THREE.Vector3, up: THREE.Vector3, out: THREE.Quaternion) {
  _f.copy(dir).normalize();
  _s.crossVectors(up, _f);
  if (_s.lengthSq() < 1e-8) _s.crossVectors(Math.abs(_f.y) < 0.9 ? UP : FORWARD, _f);
  _s.normalize();
  _u.crossVectors(_f, _s);
  _m.makeBasis(_s, _u, _f);
  return out.setFromRotationMatrix(_m);
}

export class Rig {
  readonly bones: Record<string, THREE.Bone> = {};
  readonly bind: Record<string, BindInfo> = {};
  readonly root: THREE.Object3D;

  constructor(root: THREE.Object3D) {
    this.root = root;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        // GLTFLoader strips ":" so "mixamorig:Hips" arrives as "mixamorigHips".
        const key = o.name.replace(/^mixamorig\d*:?/, "");
        this.bones[key] = o as THREE.Bone;
      }
    });
    const missing = CHAIN.map(([n]) => n).filter((n) => !this.bones[n]);
    if (missing.length) throw new Error(`Rig is missing bones: ${missing.join(", ")}`);

    for (const [name, child] of CHAIN) {
      const b = this.bones[name];
      const p = b.getWorldPosition(new THREE.Vector3());
      const worldQ = b.getWorldQuaternion(new THREE.Quaternion());
      let dir: THREE.Vector3;
      let length = 0;
      if (child) {
        const c = this.bones[child].getWorldPosition(new THREE.Vector3());
        dir = c.sub(p);
        length = dir.length();
        dir.normalize();
      } else {
        // Leaf: point the same way as the parent (head points up).
        const parentKey = CHAIN.find(([, c]) => c === name)?.[0];
        dir = parentKey ? this.bind[parentKey].dir.clone() : UP.clone();
      }
      const isFoot = /Foot|ToeBase/.test(name);
      const up = (isFoot ? UP : FORWARD).clone();
      const offset = frameQuat(dir, up, new THREE.Quaternion()).invert().multiply(worldQ);
      this.bind[name] = { worldQ, offset, dir, up, length, localQ: b.quaternion.clone(), localP: b.position.clone() };
    }
  }

  reset() {
    for (const [name] of CHAIN) {
      const b = this.bones[name];
      b.quaternion.copy(this.bind[name].localQ);
      b.position.copy(this.bind[name].localP);
    }
  }

  pos(name: string, out = new THREE.Vector3()) {
    return this.bones[name].getWorldPosition(out);
  }

  len(name: string) {
    return this.bind[name].length;
  }

  /** Point `name` along `dir` with the given up hint (keeps the parent-relative twist if omitted). */
  aim(name: string, dir: THREE.Vector3, up?: THREE.Vector3) {
    const b = this.bones[name];
    const info = this.bind[name];
    let hint = up;
    if (!hint) {
      // Carry the bind up vector along with however the parent has rotated since bind.
      const parentInfo = b.parent && this.bind[(b.parent.name || "").replace(/^mixamorig\d*:?/, "")];
      b.parent!.getWorldQuaternion(_pq);
      hint = info.up.clone();
      if (parentInfo) hint.applyQuaternion(_pq.clone().multiply(parentInfo.worldQ.clone().invert()));
    }
    frameQuat(dir, hint, _q).multiply(info.offset);
    b.parent!.getWorldQuaternion(_pq);
    b.quaternion.copy(_pq.invert().multiply(_q));
  }

  /** Move the hips joint to a world position. */
  placeHips(world: THREE.Vector3) {
    const h = this.bones.Hips;
    h.parent!.updateWorldMatrix(true, false);
    h.position.copy(h.parent!.worldToLocal(world.clone()));
  }
}

/**
 * Two-bone IK. Returns the middle joint and both segment directions.
 * `pole` is the direction the middle joint (knee / elbow) should point.
 */
export function twoBone(a: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) {
  const toT = target.clone().sub(a);
  const dist = THREE.MathUtils.clamp(toT.length(), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9995);
  const axis = toT.normalize();
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const bend = pole.clone().sub(axis.clone().multiplyScalar(pole.dot(axis)));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1);
  bend.normalize();
  const mid = a.clone().addScaledVector(axis, along).addScaledVector(bend, h);
  const end = a.clone().addScaledVector(axis, dist);
  return {
    mid,
    end,
    d1: mid.clone().sub(a).normalize(),
    d2: end.clone().sub(mid).normalize(),
    bend,
  };
}
