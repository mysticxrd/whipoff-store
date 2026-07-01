import Link from "next/link";

// Social glyphs are inline SVGs (lucide dropped brand icons); paths from the handoff.
function InstagramIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.44.79 3.07 1.2 4.79 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8c2.17 0 4.2.85 5.74 2.38a8.06 8.06 0 0 1 2.38 5.73c0 4.54-3.7 8.23-8.24 8.23h-.01c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.11.82.83-3.04-.2-.32a8.18 8.18 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23zm-4.6 4.59c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51z" />
    </svg>
  );
}

/** Global footer — deep-forest band with wordmark, socials and brand credits. */
export function SiteFooter() {
  return (
    <footer className="bg-green-950 text-green-200">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-12">
        <div className="font-display text-3xl font-black tracking-tight text-white">
          Whip off<span className="text-green-500">.</span>
        </div>
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-green-300">
          Hydroilx™ pH-neutral car shampoo. Mixed and bottled in India. 518&nbsp;ml · up
          to ~25 washes per bottle.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-sm font-medium">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center text-green-100 transition-colors hover:text-white"
          >
            Shop
          </Link>
          <span className="min-h-11 self-center text-green-700" aria-hidden>·</span>
          <Link
            href="/account"
            className="inline-flex min-h-11 items-center text-green-100 transition-colors hover:text-white"
          >
            Account
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-green-100 transition-colors hover:text-white"
          >
            <InstagramIcon />
            Instagram
          </a>
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-green-100 transition-colors hover:text-white"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 font-mono text-xs text-green-500">
          © 2026 Whipoff · Forest #143A2B · Emerald #1E7A4D · Cap #141815
        </div>
      </div>
    </footer>
  );
}
