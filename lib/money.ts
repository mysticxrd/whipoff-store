// Money formatting — integer minor units + ISO-4217 currency.
//
// Money is ALWAYS stored/handled as integer minor units (paise/pence/cents) + a currency
// code (data_conventions.md / payments.md) — NEVER a float. These helpers are the single
// place that turns that into display text, reused by the product card, PDP, and later the
// cart/checkout. Slice 1 is INR-only; the locale is fixed to en-IN for Indian digit grouping.

const MINOR_UNITS_PER_MAJOR = 100; // 2-decimal currencies (INR paise, GBP pence, USD cents).
const LOCALE = "en-IN";

/**
 * Format an integer amount of minor units in the given currency (e.g. 129900, "INR" → "₹1,299").
 * Whole amounts drop the decimals; fractional amounts keep two (e.g. 129950 → "₹1,299.50").
 */
export function formatPrice(minorUnits: number, currency: string): string {
  const major = minorUnits / MINOR_UNITS_PER_MAJOR;
  const hasFraction = minorUnits % MINOR_UNITS_PER_MAJOR !== 0;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
}

/** "from <price>" — used on listing cards for multi-variant products. */
export function formatPriceFrom(minorUnits: number, currency: string): string {
  return `from ${formatPrice(minorUnits, currency)}`;
}

// The launch sale is a flat 20%-off promo (design copy: "Save 20%"). `price_cents` always
// holds the real, currently-charged amount — there is no `compare_at_price` column (no schema
// change for a re-skin). The strikethrough "was" price shown next to it is a DERIVED display
// figure only, computed at render time, never stored or charged.
/** Whether the launch-sale badge/strikethrough renders across the storefront. Flip to end it. */
export const LAUNCH_SALE_ACTIVE = true;
const LAUNCH_SALE_FRACTION = 0.8;

/** The pre-sale strikethrough price for a launch-sale variant, derived from its current price. */
export function formatWasPrice(saleMinorUnits: number, currency: string): string {
  return formatPrice(Math.round(saleMinorUnits / LAUNCH_SALE_FRACTION), currency);
}

/**
 * Format a price span. Returns a single price when min === max, otherwise "min – max".
 * (Reserved for surfaces that show a range rather than a "from" price.)
 */
export function formatPriceRange(
  minMinorUnits: number,
  maxMinorUnits: number,
  currency: string,
): string {
  if (minMinorUnits === maxMinorUnits) return formatPrice(minMinorUnits, currency);
  return `${formatPrice(minMinorUnits, currency)} – ${formatPrice(maxMinorUnits, currency)}`;
}
