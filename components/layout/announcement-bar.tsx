/**
 * Launch announcement bar — top of every page (design v2: quiet pine strip,
 * mono instrument type, gold offer highlight).
 * Static copy for now; swap to a CMS/flag-driven message when merchandising needs it.
 * Shipping is always free (FLAT_SHIP_FEE_MINOR = 0 in lib/money.ts).
 */
export function AnnouncementBar() {
  return (
    <div className="mono-label border-b border-bone/10 bg-pine px-4 py-2.5 text-center text-bone/60 uppercase">
      Launch week — <span className="text-gold">20% off</span> &amp; free shipping across India
    </div>
  );
}
