"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Drag-to-compare slider. Reimplemented with Pointer Events + React state (not the handoff's
 * vanilla getElementById DOM writes) — pointer events unify mouse/touch in one handler and
 * setPointerCapture keeps the drag going even if the pointer leaves the element mid-gesture.
 */
export function BeforeAfterSlider() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [percent, setPercent] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setPercent(p * 100);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }
  function onPointerUp() {
    draggingRef.current = false;
  }

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-xl bg-green-950 shadow-lg [cursor:ew-resize]"
    >
      {/* AFTER — full-width gloss */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(125deg,#0A1F17 0%,#143A2B 32%,#2E8159 52%,#143A2B 70%,#0A1F17 100%)" }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(118deg,transparent 38%,rgba(255,255,255,.22) 50%,transparent 62%)" }}
        />
        <div className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-full bg-green-950/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          <span className="block size-1.5 rounded-full bg-green-400" />
          After · gloss
        </div>
      </div>

      {/* BEFORE — grime, clipped to the drag position */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - percent}% 0 0)`,
          background: "linear-gradient(125deg,#23271f,#34392f 55%,#23271f)",
        }}
      >
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage: "radial-gradient(rgba(120,120,98,.28) 1px, transparent 1.6px)",
            backgroundSize: "9px 9px",
          }}
        />
        <div className="absolute bottom-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-200">
          <span className="block size-1.5 rounded-full bg-ink-400" />
          Before · road film
        </div>
      </div>

      {/* HANDLE */}
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${percent}%` }}>
        <div className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-green-800 shadow-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
