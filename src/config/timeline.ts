/**
 * Scroll choreography for the 3D story, as fractions (0..1) of the pinned scroll distance.
 * The DOM overlays (GSAP) and the 3D scene both read these, so they stay in sync.
 */
export const SCROLL_VH = 1000;

export const SEG = {
  hero: [0, 0.08],
  curl: [0.08, 0.32],
  t1: [0.32, 0.38],
  squat: [0.38, 0.62],
  t2: [0.62, 0.68],
  deadlift: [0.68, 0.93],
  outro: [0.93, 1],
} as const;

/** Exercise swaps happen at the middle of each wipe, while the screen is fully covered. */
export const CUT1 = (SEG.t1[0] + SEG.t1[1]) / 2;
export const CUT2 = (SEG.t2[0] + SEG.t2[1]) / 2;

export const REPS = 2;

export const local = (p: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (p - a) / (b - a)));
