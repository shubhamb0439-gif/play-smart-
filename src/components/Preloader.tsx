"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { exp } from "@/lib/experienceStore";
import { useSmoothScroll } from "./SmoothScrollProvider";

/** Black cover with the mark until the 3D athlete has loaded (or 12 s, whichever first). */
export default function Preloader() {
  const ref = useRef<HTMLDivElement>(null);
  const { lock } = useSmoothScroll();

  useEffect(() => {
    lock("preloader", true);
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      window.scrollTo(0, 0);
      gsap.to(ref.current, {
        clipPath: "inset(0 0 100% 0)",
        duration: 1.1,
        ease: "power4.inOut",
        delay: 0.2,
        onComplete: () => {
          lock("preloader", false);
          if (ref.current) ref.current.style.display = "none";
        },
      });
    };
    if (exp.ready) hide();
    else exp.listeners.add(hide);
    const timer = window.setTimeout(hide, 12000);
    return () => {
      exp.listeners.delete(hide);
      window.clearTimeout(timer);
      lock("preloader", false);
    };
  }, [lock]);

  return (
    <div
      id="preloader"
      ref={ref}
      className="fixed inset-0 z-[100] grid place-items-center bg-paper [[data-clean]_&]:hidden"
      style={{ clipPath: "inset(0 0 0% 0)" }}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-dark.png" alt="" className="w-24 animate-pulse" />
        <div className="relative h-px w-40 overflow-hidden bg-ink/10">
          <span className="absolute inset-y-0 left-0 w-1/3 animate-[load_1.2s_ease-in-out_infinite] bg-red" />
        </div>
        <p className="eyebrow text-[0.58rem] text-ink/40">Warming up</p>
      </div>
      <style>{`@keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
