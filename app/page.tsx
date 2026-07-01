import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Now live · Catalog
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">
          Whipoff
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Mobile-first car-care essentials. Browse the catalog now — cart and checkout
          arrive in the next slices.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/products" className={buttonVariants({ size: "lg" })}>
            Shop all
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Sign in
          </Link>
          <Link
            href="/account"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Your account
          </Link>
        </div>
      </div>
    </main>
  );
}
