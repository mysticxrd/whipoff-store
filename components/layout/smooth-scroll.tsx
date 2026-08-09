"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Global smooth scrolling + scroll-scrubbed parallax — ports the source landing
 * design's Lenis + GSAP setup so the store matches it exactly.
 *
 * Engine (mount once):
 * - `new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true })` for the
 *   momentum/inertia scroll feel.
 * - Driven off GSAP's ticker (`gsap.ticker.add(t => lenis.raf(t * 1000))` +
 *   `lagSmoothing(0)`) and `lenis.on("scroll", ScrollTrigger.update)` — the same
 *   wiring the static site used, so ScrollTrigger stays in sync with Lenis.
 * - Same-page hash clicks eased through Lenis (`{ offset: -70, duration: 1.4 }`).
 *
 * Parallax (re-created per route, since targets differ by page):
 * - Hero wordmark drifts down + fades   (yPercent 26, opacity 0.25, scrub 0.6).
 * - Footer wordmark drifts up           (yPercent -8, scrub 0.8).
 *
 * Everything is disabled under prefers-reduced-motion (native scroll, static
 * marks), matching the source.
 */

type WithLenis = { __lenis?: Lenis };

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SmoothScroll() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  // ── Scroll engine: Lenis + GSAP ticker + ScrollTrigger wiring + anchor easing.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
    (window as unknown as WithLenis).__lenis = lenis;

    // Keep ScrollTrigger in step with Lenis, and let GSAP's ticker drive Lenis
    // (single rAF loop for both — matches the source's integration).
    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // Ease same-page hash links through Lenis (delegated, so it also covers
    // client-rendered links). Skips modified clicks so open-in-new-tab still works.
    // Runs in the CAPTURE phase and stops propagation so Next's <Link> onClick
    // (React's root-delegated handler, deeper in the tree) never fires its own
    // instant, offset-less hash scroll and beats us to it.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor || anchor.target === "_blank") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;
      if (url.hash.length <= 1) return;

      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();
      lenis.scrollTo(target, { offset: -70, duration: 1.4 });
      history.pushState(null, "", url.hash);
    };
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      lenis.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(onTick);
      lenis.destroy();
      delete (window as unknown as WithLenis).__lenis;
    };
  }, []);

  // ── Parallax scrubs + route reset. Re-runs per route: the hero title exists
  //    only on the homepage, the footer mark on every page.
  useEffect(() => {
    // On SPA navigation, jump to top immediately. Skipped on first render so a
    // deep-linked #hash landing isn't overridden.
    if (!firstRender.current) {
      (window as unknown as WithLenis).__lenis?.scrollTo(0, { immediate: true });
    }
    firstRender.current = false;

    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const heroTitle = document.querySelector<HTMLElement>('[data-parallax="hero-title"]');
      if (heroTitle) {
        gsap.to(heroTitle, {
          yPercent: 26,
          opacity: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: heroTitle.closest("section") ?? heroTitle,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      const footerMark = document.querySelector<HTMLElement>('[data-parallax="footer-mark"]');
      if (footerMark) {
        gsap.to(footerMark, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: footerMark.closest("footer") ?? footerMark,
            start: "top bottom",
            end: "bottom bottom",
            scrub: 0.8,
          },
        });
      }
    });

    // Recompute trigger positions once fonts/images/canvas settle.
    ScrollTrigger.refresh();

    // ctx.revert() kills the tweens + their ScrollTriggers and restores the
    // elements' inline styles (so the footer mark's base translateY(18%) returns).
    return () => ctx.revert();
  }, [pathname]);

  return null;
}
