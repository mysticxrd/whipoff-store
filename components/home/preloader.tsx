"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/*
 * Design v2 PRELOADER — full-screen ink overlay with the stroked WHIPOFF
 * wordmark filling bottom-up (clip-path) as a percent counter climbs: it eases
 * toward 92 while assets load, then sprints to 100 once fonts + window load
 * settle, pauses a beat, and slides up. While it runs, `html[data-wo-loading]`
 * holds the hero's char-rise / reveal animations paused (globals.css) so the
 * hero intro plays *after* the loader exits, matching the static design.
 *
 * Runs on full page loads only: a module flag skips it on client-side
 * navigations back to the homepage (the static site had no client nav).
 * Driven entirely through refs — the SSR'd overlay is mutated in place, never
 * re-rendered.
 */

let shownThisPageLoad = false;

const GATE = "data-wo-loading";

export function Preloader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const liquidRef = useRef<HTMLSpanElement>(null);
  const skippedRef = useRef(false);

  // Before first paint: bail out entirely on client-side re-mounts.
  useLayoutEffect(() => {
    if (shownThisPageLoad) {
      skippedRef.current = true;
      document.documentElement.removeAttribute(GATE);
      if (rootRef.current) rootRef.current.style.display = "none";
    } else {
      shownThisPageLoad = true;
      document.documentElement.setAttribute(GATE, "");
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (skippedRef.current || !root) return;

    const release = () => document.documentElement.removeAttribute(GATE);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    if (reduceMotion) {
      finishTimer = setTimeout(() => {
        release();
        root.style.display = "none";
      }, 100);
      return () => {
        clearTimeout(finishTimer);
        release();
      };
    }

    let assetsReady = false;
    const failsafe = setTimeout(() => (assetsReady = true), 7000);
    Promise.all([
      document.fonts.ready,
      new Promise<void>((res) =>
        document.readyState === "complete"
          ? res()
          : window.addEventListener("load", () => res(), { once: true }),
      ),
    ]).then(() => (assetsReady = true));

    let p = 0;
    const tick = () => {
      // ease toward 92 while loading, then sprint to 100
      const target = assetsReady ? 100 : 92;
      p += (target - p) * (assetsReady ? 0.16 : 0.045);
      const shown = Math.min(100, Math.round(p));
      if (pctRef.current) pctRef.current.textContent = String(shown);
      if (liquidRef.current) liquidRef.current.style.clipPath = `inset(${100 - shown}% 0 0 0)`;
      if (shown >= 100) {
        finishTimer = setTimeout(() => {
          root.style.transform = "translateY(-101%)"; // curtain up (0.9s ease-lux)
          release(); // hero intro starts as the curtain lifts
          finishTimer = setTimeout(() => (root.style.display = "none"), 950);
        }, 250);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      clearTimeout(finishTimer);
      release();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-wo-preloader=""
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink transition-transform duration-[900ms] [transition-timing-function:var(--ease-lux)]"
    >
      {/* Parser-executed on full page loads: raises the gate BEFORE first paint so
          the hero never flashes then fades out behind the curtain. The layout
          effect above lowers it again on client-side re-mounts. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute("${GATE}","")`,
        }}
      />
      {/* no-JS visitors must never be trapped behind the curtain */}
      <noscript>
        <style>{`[data-wo-preloader]{display:none}`}</style>
      </noscript>
      <div className="relative overflow-hidden">
        <span className="block font-display text-[clamp(3rem,12vw,7rem)] font-black tracking-[-0.02em] text-transparent [font-variation-settings:'opsz'_144,'SOFT'_100,'WONK'_0] [-webkit-text-stroke:1px_rgba(240,234,217,0.4)]">
          WHIPOFF
        </span>
        <span
          ref={liquidRef}
          className="pointer-events-none absolute inset-0 block font-display text-[clamp(3rem,12vw,7rem)] font-black tracking-[-0.02em] text-bone [font-variation-settings:'opsz'_144,'SOFT'_100,'WONK'_0]"
          style={{ clipPath: "inset(100% 0 0 0)" }}
        >
          WHIPOFF
        </span>
      </div>
      <div className="absolute bottom-[max(28px,env(safe-area-inset-bottom))] right-7 font-mono text-[0.85rem] text-bone/60">
        <span ref={pctRef}>0</span>
        <span className="text-gold">%</span>
      </div>
    </div>
  );
}
