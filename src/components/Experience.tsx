"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { exp } from "@/lib/experienceStore";
import { CUT1, CUT2, SCROLL_VH, SEG, local } from "@/config/timeline";
import { chapters, hero } from "@/config/content";
import { useSmoothScroll } from "./SmoothScrollProvider";
import FilmStage from "./FilmStage";

const CHAPTER_SEGS = [SEG.curl, SEG.squat, SEG.deadlift] as const;
const WIPES = [
  { seg: SEG.t1, cut: CUT1, next: chapters[1] },
  { seg: SEG.t2, cut: CUT2, next: chapters[2] },
] as const;

/** Diagonal wipe: leading edge L and trailing edge R, in % of the width (20% slant). */
const poly = (l: number, r: number) => `polygon(${l + 20}% 0%, ${r + 20}% 0%, ${r}% 100%, ${l}% 100%)`;

/** Splits a heading into lines that slide up from a clipped box. */
function Lines({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} className={`line ${className ?? ""}`}>
          <span data-line className={i === lines.length - 1 ? "text-red" : undefined}>
            {l}
          </span>
        </span>
      ))}
    </>
  );
}

export default function Experience() {
  const root = useRef<HTMLElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const { scrollTo } = useSmoothScroll();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("p")) exp.debugP = Number(q.get("p"));
    if (q.has("clean")) document.documentElement.dataset.clean = "";
  }, []);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            exp.p = self.progress;
          },
        },
      });
      tl.set({}, {}, 1); // timeline length == scroll progress

      // Hero leaves as the camera pushes in.
      tl.to(q("[data-hero]"), { autoAlpha: 0, y: -60, duration: 0.05 }, 0.025);
      tl.to(q("[data-scroll-cue]"), { autoAlpha: 0, duration: 0.02 }, 0.005);

      // Chapter panels.
      CHAPTER_SEGS.forEach(([a, b], i) => {
        const panel = q(`[data-panel="${i}"]`);
        const lines = q(`[data-panel="${i}"] [data-line]`);
        const rest = q(`[data-panel="${i}"] [data-fade]`);
        const inAt = i === 0 ? a - 0.01 : a;
        tl.set(panel, { autoAlpha: 1 }, inAt);
        tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.03, stagger: 0.006, ease: "power3.out" }, inAt);
        tl.fromTo(rest, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.025, stagger: 0.004, ease: "power2.out" }, inAt + 0.012);
        tl.to(panel, { autoAlpha: 0, y: -50, duration: 0.025, ease: "power2.in" }, b - 0.028);
        tl.set(panel, { y: 0 }, b);
      });

      // The squat copy sits on the right, so its legibility shade swaps sides under the wipe.
      tl.set(q('[data-shade="right"]'), { autoAlpha: 1 }, CUT1);
      tl.set(q('[data-shade="left"]'), { autoAlpha: 0 }, CUT1);
      tl.set(q('[data-shade="right"]'), { autoAlpha: 0 }, CUT2);
      tl.set(q('[data-shade="left"]'), { autoAlpha: 1 }, CUT2);

      // Wipes: red slab then black sweep in from the right, cover the cut, and leave to the left.
      WIPES.forEach(({ seg: [a, b], cut }, i) => {
        const red = q(`[data-wipe-red="${i}"]`);
        const black = q(`[data-wipe-black="${i}"]`);
        const label = q(`[data-wipe-label="${i}"]`);
        tl.fromTo(red, { clipPath: poly(100, 100) }, { clipPath: poly(-20, 100), duration: cut - a - 0.004, ease: "power2.in" }, a);
        tl.fromTo(black, { clipPath: poly(100, 100) }, { clipPath: poly(-20, 100), duration: cut - a - 0.006, ease: "power2.in" }, a + 0.006);
        tl.fromTo(label, { autoAlpha: 0, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 0.012 }, cut - 0.01);
        tl.to(label, { autoAlpha: 0, scale: 0.92, duration: 0.01 }, cut + 0.004);
        tl.fromTo(black, { clipPath: poly(-20, 100) }, { clipPath: poly(-20, -20), duration: b - cut - 0.006, ease: "power2.out", immediateRender: false }, cut + 0.002);
        tl.fromTo(red, { clipPath: poly(-20, 100) }, { clipPath: poly(-20, -20), duration: b - cut - 0.004, ease: "power2.out", immediateRender: false }, cut + 0.004);
      });

      // Outro.
      tl.fromTo(q("[data-outro] [data-line]"), { yPercent: 110 }, { yPercent: 0, duration: 0.03, stagger: 0.008, ease: "power3.out" }, SEG.outro[0] + 0.012);
      tl.fromTo(q("[data-outro] [data-fade]"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.02 }, SEG.outro[0] + 0.03);
      tl.fromTo(q("[data-hud]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, SEG.curl[0] - 0.02);
      tl.to(q("[data-hud]"), { autoAlpha: 0, duration: 0.02 }, SEG.outro[0]);

      // HUD text (chapter / rep) reads the live progress every frame.
      const chapterEl = hud.current?.querySelector("[data-hud-chapter]");
      const repEl = hud.current?.querySelector("[data-hud-rep]");
      const barEl = hud.current?.querySelector<HTMLElement>("[data-hud-bar]");
      const dots = hud.current?.querySelectorAll<HTMLElement>("[data-hud-dot]");
      let last = "";
      const tick = () => {
        const p = exp.debugP ?? exp.p;
        const ci = p < CUT1 ? 0 : p < CUT2 ? 1 : 2;
        const u = local(p, CHAPTER_SEGS[ci]);
        const key = String(ci);
        if (barEl) barEl.style.transform = `scaleX(${u})`;
        if (key === last) return;
        last = key;
        if (chapterEl) chapterEl.textContent = chapters[ci].lift;
        if (repEl) repEl.textContent = `${chapters[ci].index} / 0${chapters.length}`;
        dots?.forEach((d, i) => d.toggleAttribute("data-active", i === ci));
      };
      gsap.ticker.add(tick);

      // Intro once the model is ready: lights on, camera settles, hero type rises.
      const intro = () => {
        gsap.to(exp, { intro: 1, duration: 2.8, ease: "power2.inOut" });
        gsap.fromTo(q("[data-hero] [data-line]"), { yPercent: 110, y: 0, visibility: "visible" }, { yPercent: 0, y: 0, duration: 1.2, stagger: 0.1, ease: "power4.out", delay: 0.5 });
        gsap.fromTo(q("[data-hero] [data-fade], [data-scroll-cue]"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, delay: 1.0 });
      };
      if (exp.ready) intro();
      else exp.listeners.add(intro);
      return () => {
        gsap.ticker.remove(tick);
        exp.listeners.delete(intro);
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" aria-label="Play Smart training story" className="relative" style={{ height: `${SCROLL_VH + 100}vh` }}>
      {/* Anchor targets for in-page navigation. */}
      {chapters.map((c, i) => (
        <span key={c.id} id={c.id} aria-hidden className="absolute left-0" style={{ top: `${(CHAPTER_SEGS[i][0] + 0.02) * SCROLL_VH}vh` }} />
      ))}

      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="absolute inset-0">
          <FilmStage />
        </div>

        {/* Legibility gradients behind the copy. */}
        <div data-shade="left" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(255_255_255/0.8)_0%,rgb(255_255_255/0.25)_45%,transparent_60%)] max-md:bg-[linear-gradient(0deg,rgb(255_255_255/0.96)_0%,rgb(255_255_255/0.85)_42%,transparent_68%)] [[data-clean]_&]:hidden" />
        <div data-shade="right" className="pointer-events-none invisible absolute inset-0 bg-[linear-gradient(270deg,rgb(255_255_255/0.85)_0%,rgb(255_255_255/0.3)_45%,transparent_62%)] max-md:bg-[linear-gradient(0deg,rgb(255_255_255/0.96)_0%,rgb(255_255_255/0.85)_42%,transparent_68%)] [[data-clean]_&]:hidden" />

        <div className="[[data-clean]_&]:hidden">
          {/* Hero */}
          <div data-hero className="absolute inset-x-0 bottom-0 px-5 pb-24 md:inset-y-0 md:flex md:flex-col md:justify-center md:px-12 md:pt-[72px] md:pb-0 lg:px-20">
            <p data-fade className="eyebrow mb-5 text-red">
              {hero.eyebrow}
            </p>
            <h1 className="display text-[clamp(3.2rem,9vw,8.5rem)]">
              <Lines lines={hero.title} />
            </h1>
            <p data-fade className="mt-6 max-w-md text-base text-ink/70 md:text-lg">
              {hero.body}
            </p>
            <div data-fade className="mt-8 flex flex-wrap gap-3">
              <a href="#enquiry" onClick={(e) => (e.preventDefault(), scrollTo("enquiry"))} className="btn-primary">
                {hero.primary}
              </a>
              <a href="#strength" onClick={(e) => (e.preventDefault(), scrollTo("strength"))} className="btn-ghost">
                {hero.secondary}
              </a>
            </div>
          </div>

          <div data-scroll-cue className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex [@media(max-height:700px)]:!hidden">
            <span className="eyebrow text-[0.6rem] text-ink/50">Scroll to train</span>
            <span className="relative h-12 w-px overflow-hidden bg-ink/15">
              <span className="absolute inset-x-0 top-0 h-1/2 animate-[cue_1.8s_ease-in-out_infinite] bg-red" />
            </span>
          </div>

          {/* Chapters: curl (text left), squat (text right), deadlift (text left). */}
          {chapters.map((c, i) => (
            <article
              key={c.id}
              data-panel={i}
              className={`invisible absolute inset-x-0 bottom-0 px-5 pb-24 md:inset-y-0 md:flex md:flex-col md:justify-center md:pt-[72px] md:pb-0 ${
                i === 1 ? "md:right-0 md:left-auto md:w-[52%] md:pr-12 lg:pr-20" : "md:w-[52%] md:px-12 lg:px-20"
              }`}
            >
              <p data-fade className="eyebrow mb-5 flex items-center gap-3 text-ink/60">
                <span className="text-red">{c.index}</span>
                <span className="h-px w-10 bg-ink/30" />
                {c.tag}
              </p>
              <h2 className="display text-[clamp(2.4rem,4.9vw,5.4rem)]">
                <Lines lines={c.title} />
              </h2>
              <p data-fade className="mt-6 max-w-md text-base text-ink/70 md:text-lg">
                {c.body}
              </p>
              <ul className="mt-7 hidden max-w-md space-y-3 md:block">
                {c.points.map((pt) => (
                  <li key={pt} data-fade className="flex items-center gap-3 border-t border-ink/10 pt-3 text-sm text-ink/80">
                    <span className="h-1.5 w-1.5 rotate-45 bg-red" />
                    {pt}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {/* Outro */}
          <div data-outro className="absolute inset-x-0 bottom-0 px-5 pb-24 text-left md:inset-y-0 md:flex md:w-1/2 md:flex-col md:justify-center md:px-12 md:pt-[72px] md:pb-0 lg:px-20">
            <h2 className="display text-[clamp(3rem,8vw,7.5rem)]">
              <Lines lines={["Your", "turn."]} />
            </h2>
            <div data-fade className="invisible mt-8">
              <a href="#enquiry" onClick={(e) => (e.preventDefault(), scrollTo("enquiry"))} className="btn-primary">
                Claim your free session
              </a>
            </div>
          </div>

          {/* HUD */}
          <div ref={hud} data-hud className="pointer-events-none absolute right-5 bottom-6 left-5 flex items-end justify-between whitespace-nowrap md:left-1/2 md:w-80 md:-translate-x-1/2">
            <div className="w-full">
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span data-hud-chapter className="eyebrow text-[0.62rem] text-ink/80">
                  {chapters[0].lift}
                </span>
                <span data-hud-rep className="eyebrow text-[0.62rem] text-red">
                  01 / 0{chapters.length}
                </span>
              </div>
              <div className="h-px w-full bg-ink/15">
                <div data-hud-bar className="h-px origin-left scale-x-0 bg-red" />
              </div>
              <div className="mt-3 flex gap-2">
                {chapters.map((c) => (
                  <span key={c.id} data-hud-dot className="h-1 flex-1 bg-ink/15 data-[active]:bg-ink/80" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transition wipes */}
        {WIPES.map((w, i) => (
          <div key={i} aria-hidden className="pointer-events-none absolute inset-0">
            <div data-wipe-red={i} className="absolute inset-0 bg-red" style={{ clipPath: poly(100, 100) }} />
            <div data-wipe-black={i} className="absolute inset-0 grid place-items-center bg-paper" style={{ clipPath: poly(100, 100) }}>
              <div data-wipe-label={i} className="invisible text-center">
                <p className="display outline-text text-[clamp(5rem,18vw,16rem)]">{w.next.index}</p>
                <p className="eyebrow mt-4 text-red">{w.next.tag}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

