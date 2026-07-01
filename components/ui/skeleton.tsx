import * as React from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder block. Pair with reserved layout to avoid shift. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
