import { cn } from "@/lib/utils";

/** Section eyebrow (design v2): gold mono label with a hairline dash and a dimmed index. */
export function Eyebrow({
  num,
  children,
  center = false,
  className,
}: {
  num?: string;
  children: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("eyebrow mono-label uppercase", center && "eyebrow--center", className)}>
      {num ? <span className="text-bone/40">{num} /</span> : null} {children}
    </p>
  );
}
