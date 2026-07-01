import type { ReactNode } from "react";

/** Native <details>/<summary> — matches the handoff exactly, no extra shadcn primitive needed. */
export function SpecAccordion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-md border border-border bg-white">
      <summary className="flex min-h-13 cursor-pointer items-center justify-between px-4 py-3 text-sm font-bold text-foreground">
        {title}
        <span className="text-lg leading-none text-green-600 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}
