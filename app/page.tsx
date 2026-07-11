import { notFound } from "next/navigation";
import { Faq } from "@/components/home/faq";
import { Formula } from "@/components/home/formula";
import { GlossLab } from "@/components/home/gloss-lab";
import { Hero } from "@/components/home/hero";
import { Logbook } from "@/components/home/logbook";
import { Manifesto } from "@/components/home/manifesto";
import { Marquee } from "@/components/home/marquee";
import { Preloader } from "@/components/home/preloader";
import { Ritual } from "@/components/home/ritual";
import { BuyBlock } from "@/components/product/buy-block";
import { getProductBySlug } from "@/lib/catalog/queries";

// The single-product DTC landing (handoff: design-v2/index.html). The hero product resolves
// through the same Supabase-with-seed-fallback query layer as the PDP, so it's never hardcoded
// data. Section order mirrors the handoff: hero → ticker → manifesto → formula → gloss lab →
// ritual → shop → logbook → FAQ (the footer send-off lives in SiteFooter).
const HERO_PRODUCT_SLUG = "whipoff-gloss-wash";

export default async function Home() {
  const product = await getProductBySlug(HERO_PRODUCT_SLUG);
  if (!product) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <Preloader />
      <Hero product={product} />
      <Marquee />
      <Manifesto />
      <Formula />
      <GlossLab />
      <Ritual />
      {/* sticky=false: plenty of content already below the fold, unlike the focused PDP. */}
      <BuyBlock product={product} sticky={false} />
      <Logbook />
      <Faq />
    </main>
  );
}
