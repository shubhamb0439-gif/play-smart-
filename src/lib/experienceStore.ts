/**
 * Mutable, non-React state shared by the scroll timeline (writer) and the film canvas (reader).
 * Kept outside React so scrolling never triggers re-renders.
 */
export const exp = {
  /** Raw scroll progress through the pinned story, 0..1. */
  p: 0,
  /** Intro fade-in 0..1, tweened once the first frames have loaded. */
  intro: 0,
  /** Debug override from the URL: ?p=0.2 freezes the film at that progress. */
  debugP: null as number | null,
  ready: false,
  listeners: new Set<() => void>(),
};

export function markReady() {
  if (exp.ready) return;
  exp.ready = true;
  exp.listeners.forEach((f) => f());
}
