"use client";

import { useEffect, useState } from "react";
import { nav } from "@/config/content";
import { site } from "@/config/site";
import { useSmoothScroll } from "./SmoothScrollProvider";

export default function Header() {
  const { scrollTo, lock } = useSmoothScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    lock("menu", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lock]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollTo(href);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 [[data-clean]_&]:hidden">
      {/* Frosted-glass bar. Lives on its own layer: a backdrop-filter on <header> would trap the
          fixed mobile menu inside the 72px bar. */}
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[72px] border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,opacity] duration-500 ${
          open ? "opacity-0" : scrolled ? "border-white/10 bg-ink/88" : "border-white/[0.06] bg-ink/80"
        }`}
      />
      <div className="relative flex h-[72px] items-center justify-between px-5 md:px-12 lg:px-20">
        <a href="#top" onClick={go("#top")} aria-label={`${site.name}, back to top`} className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt={site.name} width={1140} height={450} className="h-11 w-auto md:h-12" />
        </a>

        <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={go(n.href)}
              className="eyebrow relative text-[0.66rem] text-white/75 transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-red after:transition-transform after:duration-300 hover:text-white hover:after:origin-left hover:after:scale-x-100"
            >
              {n.label}
            </a>
          ))}
          <a href="#enquiry" onClick={go("#enquiry")} className="btn-primary !px-5 !py-3">
            Free trial
          </a>
        </nav>

        <button
          type="button"
          className="relative z-10 grid h-11 w-11 place-items-center md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`absolute h-0.5 w-6 bg-white transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-1.5"}`} />
          <span className={`absolute h-0.5 w-6 bg-white transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-1.5"}`} />
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`fixed inset-0 flex flex-col justify-center gap-2 bg-ink px-6 text-white transition-[opacity,visibility] duration-500 md:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        {nav.map((n, i) => (
          <a key={n.href} href={n.href} onClick={go(n.href)} className="display flex items-baseline gap-4 py-2 text-5xl">
            <span className="eyebrow text-red">0{i + 1}</span>
            {n.label}
          </a>
        ))}
        <a href="#enquiry" onClick={go("#enquiry")} className="btn-primary mt-8 self-start">
          Book a free trial
        </a>
      </div>
    </header>
  );
}
