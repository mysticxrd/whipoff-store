"use client";

import { useEffect, useRef } from "react";

/*
 * Instrument gauge (design v2, ported from main.js buildGauge). A 240°-sweep
 * dial: hairline face arc, emerald target-zone arc, mono numerals, and a
 * tach-orange needle that swings from min to value (with a count-up readout)
 * the first time the gauge scrolls into view.
 */

const CX = 100;
const CY = 104;
const R = 80;
const A0 = 210; // degrees, sweep clockwise through 90 (top)
const A1 = -30;

const pt = (deg: number, rad: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  // Round: Math.cos/sin differ in the last bit between the SSR Node runtime and
  // the browser, which otherwise trips React hydration on these SVG attributes.
  return [
    Math.round((CX + rad * Math.cos(a)) * 100) / 100,
    Math.round((CY - rad * Math.sin(a)) * 100) / 100,
  ];
};
const arcPath = (a0: number, a1: number, rad: number) => {
  const [x0, y0] = pt(a0, rad);
  const [x1, y1] = pt(a1, rad);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rad} ${rad} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function Gauge({
  min,
  max,
  value,
  lo,
  hi,
  majors,
  decimals,
  valuePrefix = "",
  valueSuffix = "",
  label,
}: {
  min: number;
  max: number;
  value: number;
  /** target-zone arc bounds */
  lo: number;
  hi: number;
  majors: number;
  decimals: number;
  valuePrefix?: string;
  valueSuffix?: string;
  label: string;
}) {
  const figRef = useRef<HTMLElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const countRef = useRef<HTMLElement>(null);

  const angleFor = (v: number) => A0 + ((v - min) / (max - min)) * (A1 - A0);

  useEffect(() => {
    const fig = figRef.current;
    const needle = needleRef.current;
    const count = countRef.current;
    if (!fig || !needle || !count) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const animate = () => {
      const start = performance.now();
      const dur = reduceMotion ? 0 : 2100;
      const tick = () => {
        const t = dur === 0 ? 1 : Math.min(1, (performance.now() - start) / dur);
        const v = min + (value - min) * easeOutExpo(t);
        needle.style.transform = `rotate(${-angleFor(v)}deg)`;
        count.textContent = v.toFixed(decimals);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      tick();
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          animate();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(fig);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ticks + numerals (static — rendered server-side friendly, but the whole
  // component is client anyway for the needle animation)
  const ticks = [];
  for (let i = 0; i <= majors * 5; i++) {
    const v = min + (i / (majors * 5)) * (max - min);
    const a = angleFor(v);
    const isMajor = i % 5 === 0;
    const [x0, y0] = pt(a, R - (isMajor ? 13 : 9));
    const [x1, y1] = pt(a, R - 2);
    ticks.push(
      <line
        key={`t${i}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke={isMajor ? "rgba(240,234,217,0.7)" : "rgba(240,234,217,0.28)"}
        strokeWidth={isMajor ? 1.6 : 1}
      />,
    );
    if (isMajor) {
      const [tx, ty] = pt(a, R - 24);
      const num = min + (i / 5 / majors) * (max - min);
      ticks.push(
        <text
          key={`n${i}`}
          x={tx}
          y={ty + 3}
          textAnchor="middle"
          fontSize={8.5}
          fill="rgba(240,234,217,0.45)"
          fontFamily="'Space Mono', monospace"
        >
          {max <= 1 ? num.toFixed(1) : Math.round(num)}
        </text>,
      );
    }
  }

  const [nx, ny] = pt(0, R - 14);

  return (
    <figure
      ref={figRef}
      className="snap-center rounded-lg border border-bone/10 bg-ink px-[22px] pb-6 pt-[26px]"
    >
      <svg viewBox="0 0 200 140" className="h-auto w-full">
        <path d={arcPath(A0, A1, R)} fill="none" stroke="rgba(240,234,217,0.14)" strokeWidth={1.5} />
        <path
          d={arcPath(angleFor(lo), angleFor(hi), R - 7)}
          fill="none"
          stroke="rgba(46,158,99,0.85)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {ticks}
        <g
          ref={needleRef}
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${-angleFor(min)}deg)`,
          }}
        >
          <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#E4572E" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={5.5} fill="#0B1F16" stroke="#E4572E" strokeWidth={1.6} />
        <circle cx={CX} cy={CY} r={1.8} fill="#E4572E" />
      </svg>
      <figcaption className="mt-3.5 flex flex-col gap-1.5 text-center">
        <span className="font-mono text-[1.05rem] tracking-[0.06em] text-bone">
          {valuePrefix}
          <b ref={countRef} className="font-bold text-gold">
            {min.toFixed(decimals)}
          </b>
          {valueSuffix}
        </span>
        <span className="mono-label text-[0.6rem] text-bone/60">{label}</span>
      </figcaption>
    </figure>
  );
}
