"use client";

import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";

const STEPS = [
  {
    n: "01",
    title: "Pre-rinse",
    copy: "Knock the grit down before anything touches paint. Top to bottom, arm’s length, no hurry.",
    tip: "TIP — LET WATER GO FIRST.",
  },
  {
    n: "02",
    title: "Two buckets",
    copy: "One washes. One rinses your mitt. The grit stays in bucket two — never back on the car.",
    tip: "TIP — 19 ML IN 5 L. THAT’S IT.",
  },
  {
    n: "03",
    title: "Top down",
    copy: "Roof first. Panels get dirtier the lower you go, and gravity is on your side for once.",
    tip: "TIP — STRAIGHT LINES, LIGHT HANDS.",
  },
  {
    n: "04",
    title: "Rinse & dry",
    copy: "Sheet the water off in one open-hose pass, then a plush towel — patted, never dragged.",
    tip: "TIP — CHASE DRIPS OFF THE MIRRORS.",
  },
];

/** Design v2 RITUAL — horizontal snap track of four step cards, drag-to-scroll on fine pointers. */
export function Ritual() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState("DRAG →");

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!finePointer) {
      setHint("SWIPE →");
      return;
    }

    let down = false;
    let startX = 0;
    let startScroll = 0;
    const onDown = (e: PointerEvent) => {
      down = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add("cursor-grabbing", "snap-none");
      track.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      track.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => {
      down = false;
      track.classList.remove("cursor-grabbing", "snap-none");
    };
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <section id="ritual" className="border-t border-bone/10 py-[var(--sect)]">
      <div className="relative mx-auto mb-[clamp(40px,6vw,64px)] max-w-[1200px] px-[var(--gutter)]">
        <Reveal>
          <Eyebrow num="04" className="mb-[clamp(18px,3vw,28px)]">
            The Sunday ritual
          </Eyebrow>
        </Reveal>
        <Reveal>
          <h2 className="font-display text-[clamp(2.4rem,7.2vw,4.6rem)] font-medium leading-[1.04] tracking-tight text-balance">
            Four steps.
            <br />
            <em className="italic text-gold [font-variation-settings:'opsz'_144,'SOFT'_90,'WONK'_1]">
              One quiet hour.
            </em>
          </h2>
        </Reveal>
        <p
          aria-hidden
          className="mono-label absolute bottom-1.5 right-[var(--gutter)] text-[0.66rem] text-bone/40"
        >
          {hint}
        </p>
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        aria-label="Wash ritual steps, scroll horizontally"
        className="no-scrollbar mx-auto flex max-w-[1200px] cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-[30px] pt-1"
      >
        {STEPS.map((step) => (
          <article
            key={step.n}
            className="flex min-h-[340px] w-[min(78vw,380px)] flex-none snap-center flex-col rounded-lg border border-bone/10 bg-pine p-[clamp(26px,5vw,40px)] transition-colors duration-300 hover:border-gold/55"
          >
            <span
              aria-hidden
              className="font-display text-[clamp(3.4rem,9vw,5rem)] font-black italic leading-none text-transparent [font-variation-settings:'opsz'_144,'SOFT'_100,'WONK'_1] [-webkit-text-stroke:1px_rgba(194,164,105,0.55)]"
            >
              {step.n}
            </span>
            <h3 className="mt-auto pt-10 font-display text-[1.7rem] font-medium leading-[1.1] [font-variation-settings:'opsz'_60,'SOFT'_70,'WONK'_0]">
              {step.title}
            </h3>
            <p className="mt-3 text-[0.98rem] text-bone/60">{step.copy}</p>
            <p className="mono-label mt-5 border-t border-bone/10 pt-4 text-[0.62rem] text-gold">
              {step.tip}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
