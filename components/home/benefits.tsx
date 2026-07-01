const BENEFITS = [
  {
    title: "pH-neutral, weekly-safe",
    copy: "Sits at pH 6.5–7, so it shifts road film and bug guts without stripping your wax or sealant. Wash as often as it gets dirty — guilt-free.",
    path: "M12 3c2.5 3 5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 2.5-6 5-9Z",
  },
  {
    title: "Won't touch your coating",
    copy: "Coating-friendly surfactants leave ceramic hydrophobics intact — beading stays tight, sheeting stays fast, and gloss keeps building wash after wash.",
    path: "M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z M9 12l2 2 4-4",
  },
  {
    title: "High-foam, low-friction",
    copy: "Hydroilx™ slip polymers flood the panel with thick, lubricating foam so your mitt floats over grit. Fewer swirls, safer contact, every single wash.",
    path: "M7 21c-2 0-3.5-1.6-3.5-3.6 0-1.8 1.3-2.8 2-4 .8 1.2 2 2.2 2 4C7.5 19.4 7 21 7 21Z M11 4l1 2.3 2.3 1-2.3 1L11 10.6 10 8.3 7.7 7.3 10 6.3Z M17 11l.7 1.6 1.6.7-1.6.7L17 15.6l-.7-1.6-1.6-.7 1.6-.7Z",
  },
];

/** The handoff's "Why it works" section — three benefit cards, verbatim copy. */
export function Benefits() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-xl px-5 py-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-green-600">Why it works</p>
        <h2 className="max-w-[16ch] font-display text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          Built for people who actually detail.
        </h2>

        <div className="mt-7 flex flex-col gap-3.5">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex items-start gap-4 rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className="grid size-[50px] shrink-0 place-items-center rounded-[13px] bg-green-800 text-green-300">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={b.path} />
                </svg>
              </div>
              <div>
                <h3 className="mb-1.5 text-lg font-bold text-foreground">{b.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-600">{b.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
