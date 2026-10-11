"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { FrameStore, type Frame } from "@/lib/frameStore";
import { exp, markReady } from "@/lib/experienceStore";
import { COMPOSE, clipOffset, clips, filmAt, frameUrls, type ClipId, type DeviceKind } from "@/config/film";
import { SEG, local } from "@/config/timeline";

const MOBILE_BREAKPOINT = 768;
/** Playhead smoothing per 60 fps tick (0..1). Lower = silkier, higher = snappier. */
const LERP = 0.16;
const PRELOAD = 24;
const MAX_DECODED: Record<DeviceKind, number> = { desktop: 20, mobile: 14 };
/** Portrait fit: 0 = contain (whole frame), 1 = cover (fills the screen, crops heavily). */
const PORTRAIT_FILL = 0.55;

/**
 * Scroll-scrubbed film: the Grok clips as one frame sequence drawn on a canvas.
 * Each clip can be shifted/scaled on wide screens (so the athlete sits opposite the copy);
 * any exposed edge is feathered into the clip's background, so the frame melts into the page.
 */
export default function FilmStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const kind: DeviceKind = window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
    // Touch devices get a CPU-backed canvas; a GPU canvas keeps a texture per drawn frame.
    const lowMemory = kind === "mobile" || window.matchMedia("(pointer: coarse)").matches;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: lowMemory })!;

    let needsDraw = true;
    const store = new FrameStore({
      urls: frameUrls(kind),
      priority: PRELOAD,
      chunkSize: 30,
      concurrency: 6,
      maxDecoded: MAX_DECODED[kind],
      onPriorityDone: () => {
        needsDraw = true;
        markReady();
      },
    });
    store.start();

    let cw = 0;
    let ch = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      cw = Math.max(1, Math.round(r.width * dpr));
      ch = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.imageSmoothingQuality = lowMemory ? "medium" : "high";
      needsDraw = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let clip: ClipId = "curl";
    let current = 0;
    let drawn: Frame | undefined;
    let lastKey = "";
    const tick = (_t: number, deltaTime: number) => {
      const p = exp.debugP ?? exp.p;
      const target = filmAt(p);
      // Never tween across a cut: the wipe hides the swap, so snap straight to the new clip.
      if (target.clip !== clip) {
        clip = target.clip;
        current = target.frame;
      } else {
        const k = 1 - Math.pow(1 - LERP, deltaTime / (1000 / 60));
        const diff = target.frame - current;
        current = Math.abs(diff) < 0.01 ? target.frame : current + diff * k;
      }
      const index = clipOffset[clip] + Math.round(current);
      store.focus(index);
      const frame = store.nearest(index);

      // Hero starts slightly wide and pushes in as you scroll; the intro adds a gentle settle.
      const zoom = 1 - 0.07 * (1 - local(p, SEG.hero)) * (p < SEG.curl[0] ? 1 : 0) + 0.04 * (1 - exp.intro);
      const key = `${clip}|${zoom.toFixed(4)}|${cw}x${ch}`;
      if (frame && (frame !== drawn || key !== lastKey || needsDraw)) {
        draw(ctx, frame, cw, ch, clip, kind, zoom);
        drawn = frame;
        lastKey = key;
        needsDraw = false;
      }
      canvas.style.opacity = String(exp.debugP != null ? 1 : exp.intro);
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      store.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-paper" style={{ opacity: 0 }} aria-hidden="true" />;
}

function draw(ctx: CanvasRenderingContext2D, img: Frame, cw: number, ch: number, clip: ClipId, kind: DeviceKind, zoom: number) {
  const iw = img.width;
  const ih = img.height;
  const landscape = cw / ch > 1.05;
  // Phones use the portrait crops, already centred on the athlete: plain cover.
  const c = kind === "desktop" && landscape ? COMPOSE[clip] : { athleteX: kind === "mobile" ? 0.5 : clips[clip].focusX, screenX: 0.5, scale: 1 };
  const cover = Math.max(cw / iw, ch / ih);
  const contain = Math.min(cw / iw, ch / ih);
  // Portrait screens: part-way between contain and cover, so heads and bars stay in shot,
  // sitting high so the copy has room underneath.
  const s = (landscape ? cover : contain * Math.pow(cover / contain, PORTRAIT_FILL)) * c.scale * zoom;
  const w = iw * s;
  const h = ih * s;
  let x = c.screenX * cw - c.athleteX * w;
  // Don't open a gap on both sides at once; prefer keeping the frame edge-to-edge where possible.
  if (w >= cw) x = Math.min(Math.max(x, cw - w - w * 0.25), w * 0.25);
  const y = landscape ? (ch - h) / 2 : Math.max(0, Math.min(ch * 0.4 - h / 2, ch - h));

  // Paint the clip's own background colour around the frame, and feather into it.
  const bg = clips[clip].colors.border;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, x, y, w, h);

  // Feather any edge of the frame that sits inside the canvas.
  const fx = w * 0.14;
  const fy = h * 0.08;
  const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(rx, ry, rw, rh);
  };
  if (x > 0.5) fade(x, 0, x + fx, 0, x, 0, fx, ch);
  if (x + w < cw - 0.5) fade(x + w, 0, x + w - fx, 0, x + w - fx, 0, fx, ch);
  if (y > 0.5) {
    fade(0, y, 0, y + fy, 0, y, cw, fy);
    fade(0, y + h, 0, y + h - fy, 0, y + h - fy, cw, fy);
  }
}
