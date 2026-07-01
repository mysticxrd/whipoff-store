import Image from "next/image";
import { ProductImage } from "@/components/catalog/product-image";

/**
 * Renders a real photo (next/image) when a gallery row has a real `public/` path, and falls
 * back to the gradient placeholder for rows still using a "gradient:<slug>:<pos>" token.
 * Lets products with real photography and products without it coexist without a schema change.
 */
export function CatalogImage({
  url,
  alt,
  name,
  className,
  sizes,
  priority,
}: {
  url: string;
  alt: string;
  /** Product title — used by the gradient fallback to derive its monogram. */
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (url.startsWith("gradient:")) {
    return <ProductImage token={url} alt={alt} name={name} className={className} />;
  }

  return (
    <Image
      src={url}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
      className={className ?? "object-contain"}
    />
  );
}
