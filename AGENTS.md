# AGENTS.md — Whipoff store

Read this file first, then `HANDOFF.md` for the current release state and deployment runbook.

## Product and stack

Whipoff is a mobile-first, single-product car-care storefront for *Gloss Wash*, priced in INR.
It uses Next.js 16 App Router, React Server Components and Server Actions, strict TypeScript,
Tailwind v4, shadcn/ui, Supabase, Razorpay Standard Checkout, Resend, Sentry, PostHog/GA4, and
Vercel.

This `store/` directory is the deployable application and its own Git repository. Its remote is
`github.com/mysticxrd/whipoff-store`.

## Commands

Package manager: pnpm.

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
```

The required green bar before deployment is:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The current suite contains 169 tests. `next/font` downloads the configured Google Fonts during a
clean production build, so the build environment needs network access to `fonts.googleapis.com`.

## Environment

Copy `.env.example` to `.env.local` and supply real values from the service dashboards.
`.env.local` and `.vercel/` are ignored and must never be committed.

Client variables are validated in `lib/env.ts`; server secrets are read lazily through
`lib/env-server.ts`, which imports `server-only`.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — test mode must begin with `rzp_test_`
- `RAZORPAY_KEY_SECRET` — server only
- `RAZORPAY_WEBHOOK_SECRET` — server only

Optional variables:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_GA4_ID`
- `NEXT_PUBLIC_SENTRY_DSN`

## Code map

```text
app/                              App Router routes
  page.tsx                        Single-product storefront
  cart/ checkout/                 Cart and Razorpay checkout
  account/ (auth)/                Magic-link auth, profile, order history
  api/webhooks/razorpay/          Signature-verified order writer
  auth/callback/                  PKCE exchange and guest-order claim
components/                       UI and client interaction leaves
lib/
  env.ts env-server.ts            Client/server environment split
  razorpay.ts                     Orders API and HMAC verification
  supabase/                       Browser, server, admin, and middleware clients
  contracts.ts                    Zod request and database contracts
  cart/ checkout/ orders/ email/  Domain logic and services
  money.ts                        INR minor-unit arithmetic
server/actions/                   Validated Server Actions
server/email/                     Resend confirmation orchestration
supabase/migrations/              Ordered database migrations
tests/                            Vitest unit tests
```

## Non-negotiable invariants

1. Never expose a secret to the browser. Anything prefixed `NEXT_PUBLIC_` is public. The Supabase
   service-role key, Razorpay key secret, webhook secret, and Resend key remain server-only.
2. Enable Row-Level Security on every Supabase table. Only the payment webhook may use the admin
   client/service role; normal request paths must use RLS-scoped clients.
3. The Razorpay webhook is the sole writer of paid-order state. It verifies the raw-body HMAC
   before parsing, deduplicates events, enforces unique `provider_order_id`, and checks the paid
   amount against the server-staged total.
4. Razorpay stays in test mode until a separately approved live-payment change. The
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` Zod rule deliberately rejects non-`rzp_test_` keys.
5. Store money as integer paise in INR. Never use floating-point arithmetic for prices or totals.
6. Validate every Server Action input with the schemas in `lib/contracts.ts` before database work.
7. Test the payment migration on an isolated Supabase preview/branch database first. It renames
   payment columns and removes the old Stripe RPCs, so applying it early to the current production
   database would break the deployed Stripe checkout.

## Testing limits

Unit tests cover cart math, checkout pricing, money, contracts, webhook verification, and email
orchestration. Payment, webhook delivery, authentication, RLS, and telemetry require a real
Supabase branch, Razorpay test account, and Vercel preview. Follow `HANDOFF.md` exactly.

## Workspace relationship

When this repository is inside the `whipoff-build/` master workspace, follow the parent MWP stage
contracts. Live mutations belong only to stage `04_ship`, with separate approval gates for remote
pushes, preview infrastructure, production migrations, production promotion, and live-payment key
switches.

When `store/` is cloned standalone, the parent stage files are absent. Preserve the same sequence
and safety invariants using `HANDOFF.md`; do not treat a standalone clone as permission to skip the
preview and production approval gates.
