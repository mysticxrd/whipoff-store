import { BeforeAfterSlider } from "@/components/home/before-after-slider";

/** The handoff's "Proof" section — before/after drag-compare + caption. */
export function Proof() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-xl px-5 py-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-green-600">Proof</p>
        <h2 className="max-w-[16ch] font-display text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          Two weeks of grime, gone in a pass.
        </h2>
        <p className="mt-3.5 max-w-[46ch] text-base leading-relaxed text-ink-600">
          Drag the handle. Left is a panel coated in road film; right is the same panel after a
          single Whipoff wash — flat gloss and tight beading.
        </p>

        <div className="mt-6">
          <BeforeAfterSlider />
        </div>
        <p className="mt-3 text-center font-mono text-xs text-ink-400">drag to compare · illustrative</p>
      </div>
    </section>
  );
}
