"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/money";

/*
 * Dilution calculator (design v2's "DILUTION MATH — YOUR BUCKET").
 * dose = bucket ÷ 256; washes = bottle ÷ dose; cost = price ÷ washes.
 * Priced off the product's base bottle (passed by BuyBlock) — purely
 * illustrative, so it doesn't track the variant selector's state.
 */
export function DilutionCalc({
  bottleMl,
  priceMinor,
  currency,
}: {
  bottleMl: number;
  priceMinor: number;
  currency: string;
}) {
  const [litres, setLitres] = useState(5);

  const doseMl = Math.floor((litres * 1000) / 256); /* floor: 5 L → 19 ml, matches spec/FAQ copy */
  const washes = bottleMl / ((litres * 1000) / 256);
  const costMinor = Math.max(100, Math.round(priceMinor / washes / 100) * 100);

  return (
    <div className="mt-[34px] rounded-lg border border-bone/[0.14] bg-ink p-[22px]">
      <p className="mono-label text-[0.62rem] text-gold uppercase">Dilution math — your bucket</p>
      <div className="mb-1 mt-2">
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={litres}
          onChange={(e) => setLitres(parseInt(e.target.value, 10))}
          aria-label="Bucket size in litres"
        />
      </div>
      <p className="mono-label text-[0.68rem] leading-8 text-bone/60 uppercase">
        <span className="font-bold text-bone">{litres} L</span> bucket →{" "}
        <span className="font-bold text-bone">{doseMl} ML</span> dose →{" "}
        <span className="font-bold text-bone">{formatPrice(costMinor, currency)}</span>
        &nbsp;/&nbsp;wash
      </p>
    </div>
  );
}
