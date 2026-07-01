"use client";

import { useState } from "react";
import { ProductImage } from "@/components/catalog/product-image";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageRow } from "@/supabase/types";

/** PDP gallery: one main image + a thumbnail strip. Aspect ratios reserved (no layout shift). */
export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImageRow[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border">
        <ProductImage
          token={active?.url ?? productName}
          alt={active?.alt ?? productName}
          name={productName}
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => {
            const selected = index === activeIndex;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "relative size-16 shrink-0 overflow-hidden rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected ? "border-primary" : "border-border hover:border-foreground/40",
                  )}
                >
                  <ProductImage
                    token={image.url}
                    alt={image.alt ?? `${productName} thumbnail ${index + 1}`}
                    name={productName}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
