import { FREE_SHIP_THRESHOLD_MINOR, formatPrice } from "@/lib/money";

/**
 * Launch announcement bar — top of every page (design: dark forest strip).
 * Static copy for now; swap to a CMS/flag-driven message when merchandising needs it.
 * The free-shipping figure is single-sourced from FREE_SHIP_THRESHOLD_MINOR (lib/money.ts) —
 * the same number the cart drawer's free-ship bar computes against.
 */
export function AnnouncementBar() {
  return (
    <div className="bg-green-800 px-4 py-2 text-center text-xs font-semibold tracking-wide text-green-100">
      Launch week — 20% off &amp; free shipping across India over{" "}
      {formatPrice(FREE_SHIP_THRESHOLD_MINOR, "INR")}
    </div>
  );
}
