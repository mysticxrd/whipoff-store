"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/cart-provider";

/** Opens the cart drawer once on mount. Used by the /cart fallback route. Renders nothing. */
export function OpenCartDrawer() {
  const { open } = useCart();

  useEffect(() => {
    open();
  }, [open]);

  return null;
}
