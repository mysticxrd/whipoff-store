import Link from "next/link";

// Social glyphs are inline SVGs (lucide dropped brand icons); paths from the handoff.
function InstagramIcon() {
  return (
    <svg
      width="15"
      height="15"
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.44.79 3.07 1.2 4.79 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8c2.17 0 4.2.85 5.74 2.38a8.06 8.06 0 0 1 2.38 5.73c0 4.54-3.7 8.23-8.24 8.23h-.01c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.11.82.83-3.04-.2-.32a8.18 8.18 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23zm-4.6 4.59c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51z" />
    </svg>
  );
}

/**
 * Global footer — design v2: pine band with an italic Fraunces send-off line,
 * mono link columns, the giant moss wordmark bleeding off the bottom, and a
 * hairline legal row.
 */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-t border-bone/10 bg-pine text-bone">
      <div className="px-[var(--gutter)] pt-20 sm:pt-28">
        {/* Send-off CTA */}
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 pb-16 text-center sm:pb-24">
          <p className="font-display text-4xl font-medium italic leading-tight tracking-tight [font-variation-settings:'opsz'_144,'SOFT'_90,'WONK'_1] sm:text-6xl">
            The whip deserves it.
          </p>
          <Link
            href="/#buy"
            className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-bone px-7 font-medium text-ink transition-colors hover:bg-gold"
          >
            Shop Gloss Wash
          </Link>
        </div>

        {/* Link columns */}
        <div className="mono-label mx-auto grid max-w-5xl gap-8 pb-14 uppercase sm:grid-cols-3 sm:pb-20">
          <div className="flex flex-col gap-3">
            <span className="mb-1 text-gold">Shop</span>
            <Link
              href="/"
              className="py-1 text-bone/60 transition-colors hover:text-bone"
            >
              Gloss Wash
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="mb-1 text-gold">Company</span>
            <Link href="/#formula" className="py-1 text-bone/60 transition-colors hover:text-bone">
              The formula
            </Link>
            <Link href="/account" className="py-1 text-bone/60 transition-colors hover:text-bone">
              Account
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="mb-1 text-gold">Elsewhere</span>
            <a
              href="https://www.instagram.com/whipoff._/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-1 text-bone/60 transition-colors hover:text-bone"
            >
              <InstagramIcon />
              Instagram
            </a>
            <a
              href="https://wa.me/message/RDUSEAB6GG7HA1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-1 text-bone/60 transition-colors hover:text-bone"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
            <a
              href="mailto:tmwhipoff@gmail.com"
              className="py-1 text-bone/60 transition-colors hover:text-bone"
            >
              tmwhipoff@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* Giant wordmark, clipped by the footer edge */}
      <div
        aria-hidden
        data-parallax="footer-mark"
        className="select-none text-center font-display text-[clamp(4rem,19vw,19rem)] font-black leading-[0.72] tracking-tight text-moss [transform:translateY(18%)]"
      >
        WHIPOFF
      </div>

      <div className="mono-label relative flex flex-col gap-2 border-t border-bone/10 bg-pine px-[var(--gutter)] py-5 text-[0.6rem] text-bone/60 uppercase md:flex-row md:justify-between">
        <span>© 2026 Whipoff Labs Pvt.</span>
        <span>Made for the ones who look back.</span>
      </div>
    </footer>
  );
}
