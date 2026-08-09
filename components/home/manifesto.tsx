"use client";

import { useEffect, useRef } from "react";
import { Eyebrow } from "@/components/home/eyebrow";
import { Reveal } from "@/components/home/reveal";

const LINES = [
  <>Anyone can clean a car.</>,
  <>This is for the ones who</>,
  <>turn around after parking</>,
  <>
    <em className="italic text-gold [font-variation-settings:'opsz'_144,'SOFT'_100,'WONK'_1]">
      — just to look.
    </em>
  </>,
];

/** Design v2 MANIFESTO — masked lines rise in a stagger the first time the block scrolls in. */
export function Manifesto() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.28 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="manifesto" className="mx-auto max-w-[1060px] px-[var(--gutter)] py-[var(--sect)]">
      <Reveal>
        <Eyebrow num="01" className="mb-[clamp(18px,3vw,28px)]">
          A love letter to wash day
        </Eyebrow>
      </Reveal>
      <h2
        ref={ref}
        className="whitespace-nowrap font-display text-[clamp(1.3rem,6vw,4.2rem)] font-normal leading-[1.16] tracking-[-0.01em] [font-variation-settings:'opsz'_144,'SOFT'_70,'WONK'_0] sm:whitespace-normal"
      >
        {LINES.map((line, i) => (
          <span key={i} className="line-mask">
            <span
              className="line-rise"
              style={{ "--reveal-delay": `${i * 120}ms` } as React.CSSProperties}
            >
              {line}
            </span>
          </span>
        ))}
      </h2>
      <Reveal>
        <p className="mt-[clamp(28px,5vw,44px)] max-w-[560px] text-bone/60">
          Whipoff is a pH-neutral, coating-safe shampoo built around one idea: the wash isn’t a
          chore. It’s the hour your week finally goes quiet. Two buckets. Thick foam. Water
          sheeting off the panels in one clean sweep. That’s the whole religion.
        </p>
      </Reveal>
    </section>
  );
}
