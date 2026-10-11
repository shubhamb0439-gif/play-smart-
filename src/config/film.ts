import film from "./film.json";
import { CUT1, CUT2, SEG, local } from "./timeline";

export type ClipId = "curl" | "squat" | "deadlift";
export type DeviceKind = "desktop" | "mobile";

export const CLIP_ORDER: ClipId[] = ["curl", "squat", "deadlift"];
export const clips = film.clips as Record<ClipId, (typeof film.clips)["curl"]>;

/** First global frame index of each clip (all clips share one loader). */
export const clipOffset: Record<ClipId, number> = (() => {
  let n = 0;
  const out = {} as Record<ClipId, number>;
  for (const id of CLIP_ORDER) {
    out[id] = n;
    n += clips[id].count;
  }
  return out;
})();
export const totalFrames = CLIP_ORDER.reduce((n, id) => n + clips[id].count, 0);

export function frameUrls(kind: DeviceKind): string[] {
  return CLIP_ORDER.flatMap((id) =>
    Array.from({ length: clips[id].count }, (_, i) => `${clips[id][kind].folder}/${film.pattern.replace("{index}", String(i).padStart(film.pad, "0"))}?v=${film.version}`),
  );
}

/**
 * Time remap per clip: [chapter progress 0..1, frame]. Lets slow phases (the squat descent)
 * and fast ones (the drive up) each get a fair share of the scroll.
 */
const CURVES: Record<ClipId, [number, number][]> = {
  // 0-0.5 s arm down, 0.5-1.5 s curl up, then a squeeze while the camera eases in.
  // The lowering half plays it back in reverse.
  curl: [
    [0, 0],
    [0.05, 8],
    [0.34, 36],
    [0.56, 86],
    [0.62, 86],
    [0.84, 36],
    [0.97, 0],
    [1, 0],
  ],
  // Two reps on a locked camera; the quick descents get stretched across more scroll.
  squat: [
    [0, 0],
    [0.04, 12],
    [0.19, 30],
    [0.25, 48],
    [0.38, 60],
    [0.47, 90],
    [0.62, 108],
    [0.68, 126],
    [0.84, 138],
    [0.9, 144],
    [1, 144],
  ],
  // From the floor: pull, lockout hold, lower, pull again, finish standing.
  deadlift: [
    [0, 0],
    [0.06, 4],
    [0.28, 16],
    [0.36, 49],
    [0.58, 66],
    [0.62, 68],
    [0.88, 80],
    [1, 82],
  ],
};

function sample(curve: [number, number][], u: number) {
  for (let i = 1; i < curve.length; i++) {
    const [u1, f1] = curve[i];
    if (u <= u1) {
      const [u0, f0] = curve[i - 1];
      const t = u1 === u0 ? 1 : (u - u0) / (u1 - u0);
      return f0 + (f1 - f0) * t;
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * Desktop composition per clip. athleteX: where the athlete is in the frame (0..1);
 * screenX: where we want them on screen; scale: relative to "cover".
 * The frame is shifted/scaled and any exposed edge feathers into black.
 */
export const COMPOSE: Record<ClipId, { athleteX: number; screenX: number; scale: number }> = {
  curl: { athleteX: 0.47, screenX: 0.7, scale: 0.9 },
  squat: { athleteX: 0.48, screenX: 0.25, scale: 0.8 },
  deadlift: { athleteX: 0.5, screenX: 0.68, scale: 0.84 },
};

/** Which clip and (fractional) frame to show for a scroll progress. */
export function filmAt(p: number): { clip: ClipId; frame: number } {
  if (p < CUT1) {
    const f = p < SEG.curl[0] ? 0 : sample(CURVES.curl, local(p, SEG.curl));
    return { clip: "curl", frame: f };
  }
  if (p < CUT2) return { clip: "squat", frame: p < SEG.squat[0] ? 0 : sample(CURVES.squat, local(p, SEG.squat)) };
  if (p <= SEG.deadlift[1]) return { clip: "deadlift", frame: p < SEG.deadlift[0] ? 0 : sample(CURVES.deadlift, local(p, SEG.deadlift)) };
  // Outro: the clip already ends standing tall at lockout; hold it.
  return { clip: "deadlift", frame: clips.deadlift.count - 1 };
}
