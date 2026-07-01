const STEPS = [
  { n: "01", title: "Pre-rinse", copy: "Blast off loose grit with a strong rinse or a snow-foam pre-soak, so you're never grinding dirt into the paint." },
  { n: "02", title: "Two buckets", copy: "One to wash, one to rinse. Add 1–2 capfuls to a bucket of warm water and agitate into a thick foam." },
  { n: "03", title: "Wash top-down", copy: "Glide a clean mitt panel by panel, rinsing it often. Let the foam carry the dirt — don't scrub." },
  { n: "04", title: "Rinse & dry", copy: "Sheet the water off, then dry with a plush microfibre before it spots. Stand back. Admire." },
];

/** The handoff's "The wash" section — four numbered steps on a dark forest band. */
export function HowTo() {
  return (
    <section className="bg-green-900 text-white">
      <div className="mx-auto max-w-xl px-5 py-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-green-400">The wash</p>
        <h2 className="max-w-[15ch] font-display text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
          Four steps. One bucket of foam.
        </h2>

        <div className="mt-7">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className={`flex items-start gap-4 border-t border-white/10 py-5 ${
                i === STEPS.length - 1 ? "border-b" : ""
              }`}
            >
              <span className="min-w-11 font-display text-3xl font-black leading-none text-green-500">
                {step.n}
              </span>
              <div>
                <h3 className="mb-1 text-[17px] font-bold text-white">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-green-300">{step.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
