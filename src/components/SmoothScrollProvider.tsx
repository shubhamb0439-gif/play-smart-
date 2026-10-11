"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useMediaQuery";

type Ctx = {
  scrollTo: (target: string | HTMLElement | number, opts?: { immediate?: boolean }) => void;
  /** Pause scrolling while any key holds a lock (preloader, mobile menu…). */
  lock: (key: string, locked: boolean) => void;
};

const SmoothScrollContext = createContext<Ctx>({ scrollTo: () => {}, lock: () => {} });
export const useSmoothScroll = () => useContext(SmoothScrollContext);

export const HEADER_OFFSET = 72;

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);
  const locks = useRef(new Set<string>());

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, autoRaf: false });
    lenisRef.current = lenis;
    if (locks.current.size) lenis.stop();
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const scrollTo = useCallback<Ctx["scrollTo"]>((target, opts) => {
    const el = typeof target === "string" ? document.getElementById(target.replace(/^#/, "")) : target;
    if (el === null) return;
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(el, { offset: typeof el === "number" ? 0 : -HEADER_OFFSET, immediate: opts?.immediate, duration: 1.6 });
    } else if (typeof el === "number") {
      window.scrollTo({ top: el });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET });
    }
    if (typeof el !== "number") {
      // Move focus for keyboard and screen-reader users without a second jump.
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
  }, []);

  const lock = useCallback((key: string, locked: boolean) => {
    if (locked) locks.current.add(key);
    else locks.current.delete(key);
    const any = locks.current.size > 0;
    document.documentElement.classList.toggle("scroll-locked", any);
    if (any) lenisRef.current?.stop();
    else lenisRef.current?.start();
  }, []);

  return <SmoothScrollContext.Provider value={{ scrollTo, lock }}>{children}</SmoothScrollContext.Provider>;
}
