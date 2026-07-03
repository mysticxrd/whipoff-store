"use client";

import { useEffect, useRef } from "react";
import { clearCartAfterCheckout } from "@/server/actions/checkout";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Invisible leaf mounted by the return page's COMPLETE branches: fires the cart-clear
 * Server Action exactly once (ref-guarded against strict-mode double mount). The action
 * re-verifies the session with Stripe server-side; on success the fresh (empty) CartView
 * replaces the client cart so the header badge/drawer match immediately. Best-effort — the
 * webhook's RPC clear remains authoritative for DB carts.
 */
export function FinalizeReturn({ sessionId }: { sessionId: string }) {
  const { replaceCart } = useCart();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void clearCartAfterCheckout({ sessionId }).then((result) => {
      if (result.ok && result.data) replaceCart(result.data);
    });
  }, [sessionId, replaceCart]);

  return null;
}
