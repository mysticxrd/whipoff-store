import { notFound } from "next/navigation";
import { Benefits } from "@/components/home/benefits";
import { Hero } from "@/components/home/hero";
import { HowTo } from "@/components/home/how-to";
import { Marquee } from "@/components/home/marquee";
import { Proof } from "@/components/home/proof";
import { BuyBlock } from "@/components/product/buy-block";
import { getProductBySlug } from "@/lib/catalog/queries";

// The single-product DTC landing (handoff: Whipoff.dc.html). The hero product resolves through
// the same Supabase-with-seed-fallback query layer as the PDP, so it's never hardcoded data.
const HERO_PRODUCT_SLUG = "whipoff-gloss-wash";

export default async function Home() {
  const product = await getProductBySlug(HERO_PRODUCT_SLUG);
  if (!product) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <Hero product={product} />
      <Marquee />
      <Benefits />
      <HowTo />
      <Proof />
      {/* sticky=false: plenty of content already below the fold, unlike the focused PDP. */}
      <BuyBlock product={product} sticky={false} />
    </main>
  );
}
