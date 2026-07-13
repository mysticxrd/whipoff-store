import type { ReactNode } from "react";

/** Native <details>/<summary> — design v2: hairline rows, gold "+" that rotates open. */
export function SpecAccordion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-bone/10 last:border-b">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-5 py-4 text-sm font-medium text-foreground transition-colors hover:text-gold">
        {title}
        <span
          className="text-lg leading-none text-gold transition-transform group-open:rotate-45"
          aria-hidden
        >
          +
        </span>
      </summary>
      <div className="max-w-[620px] pb-5 text-sm leading-relaxed text-bone/60">{children}</div>
    </details>
  );
}
