# HANDOFF.md — current state and release runbook

Companion to `AGENTS.md`. Snapshot date: **2026-07-20**.

## 1. Current state

Production at `https://whipoff-store.vercel.app` still runs commit `aff737f` from `main`: the old
design with Stripe in test mode. `origin/main` points to the same commit.

The release candidate is local branch `integrate-rzp-design`. Its application content is integrated
through `db973b5` and combines:

- `razorpay-swap`: Razorpay checkout, signature-verified webhook, provider-neutral payment schema,
  and removal of Stripe dependencies.
- `design-v2`: racing-green single-product storefront, WHIPOFF preloader, and Lenis/GSAP motion.
- A regenerated `pnpm-lock.yaml` containing the design dependencies and no Stripe packages.

As of the 2026-07-19 local readiness pass:

- Frozen lockfile install passed.
- TypeScript and ESLint passed with zero findings.
- All 169 tests passed.
- The production build passed.
- The deterministic security shield passed with zero violations.
- The tracked-secret scan found no credential-shaped values.
- Git integrity passed.

The branch was pushed on 2026-07-20 and is tracked by draft PR
[`#1`](https://github.com/mysticxrd/whipoff-store/pull/1). Vercel automatically built a Ready preview
at `https://whipoff-store-git-integrate-rzp-design-hishamxrd-2949s-projects.vercel.app`.

The preview is **not payment-ready yet**: an isolated Supabase branch, Razorpay test credentials,
Preview-scoped environment variables, webhook, and auth redirects still need to be configured. Do
not exercise checkout against inherited production database settings. The next gate is isolated
preview infrastructure.

## 2. Existing infrastructure

| Service | Identifier | State |
|---|---|---|
| Vercel | project `whipoff-store`; project ID `prj_s3SKrcDSeR0CqD6vQznByJJRQdBN`; team `team_gO0S4hNwMg0bEHVkSHiV9bDW` | Production builds `main`; PR #1 preview is Ready but not environment-configured. |
| Supabase | production project ref `rfjjyrbimnlwivkcdmqv` | Stripe-era migrations applied; Razorpay migration is pending. |
| GitHub | `github.com/mysticxrd/whipoff-store` | `integrate-rzp-design` is pushed; draft PR #1 targets `main`. |
| Razorpay | Test account credentials required | Test mode only for preview and initial production smoke. |
| Stripe | Existing test configuration | Retire only after the Razorpay cutover succeeds. |
| Resend | Optional during payment verification | Unconfigured sends are recorded as skipped. |

The committed migration is `supabase/migrations/20260712090000_razorpay_swap.sql`. It creates
`payment_events`, `checkout_sessions`, `record_paid_order(...)`, and
`mark_checkout_failed(...)`; renames Stripe-specific order columns; removes the old Stripe RPCs;
and drops `stripe_events`.

## 3. Required environment variables

Use real values from the dashboards. Never commit them.

| Variable | Scope | Release action |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Point Preview to the branch database and Production to production. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Match the selected Supabase environment. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Match the selected Supabase environment. |
| `NEXT_PUBLIC_APP_URL` | Client | Set to the exact Preview or Production origin. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client | Add a `rzp_test_...` key ID. |
| `RAZORPAY_KEY_SECRET` | Server only | Add the matching test key secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | Match the secret configured on that environment's webhook. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Server only | Optional until the sending domain is ready. |
| PostHog, GA4, Sentry variables | Client | Configure per environment for release verification. |
| Stripe variables | Existing deployment | Remove only after the Razorpay production cutover is healthy. |

The current local `.env.local` still contains Stripe-era configuration. `/checkout` showing
“payments not configured” is expected until Razorpay test variables are supplied.

## 4. Release sequence

### 4.1 Preserve the release candidate

**Completed 2026-07-20:** `integrate-rzp-design` is pushed and draft PR #1 is open against `main`.
The commands below remain as recovery documentation for a fresh clone.

After explicit approval:

```bash
git push -u origin integrate-rzp-design
```

Open a pull request into `main`, but do not merge it yet. This preserves the local-only work and
gives Vercel a reviewable branch. Recreate `.env.local` after any fresh clone because it is ignored.

### 4.2 Create isolated preview infrastructure

Create a Supabase preview/branch database before applying the Razorpay migration. Do not link the
preview workflow to production project `rfjjyrbimnlwivkcdmqv`.

Apply all migrations, including `20260712090000_razorpay_swap.sql`, to the branch database. Generate
types from that branch and run the green bar again.

Verify in the branch database:

- RLS is enabled on every table.
- `payment_events` and `checkout_sessions` have no anon/authenticated policies and therefore deny
  direct client access.
- Guest staging rows are invisible to clients.
- `orders_select_own` remains owner-only.
- `record_paid_order` and `mark_checkout_failed` can be executed only by `service_role`.
- `provider_order_id` is unique.
- The old Stripe RPCs and `stripe_events` are absent.

### 4.3 Configure the Vercel preview and Razorpay test webhook

Set Preview-scoped Vercel variables to the Supabase branch and Razorpay test credentials. Set
`NEXT_PUBLIC_APP_URL` to the exact preview origin and add that origin to the Supabase Auth redirect
allowlist.

Create a Razorpay test-mode webhook for:

```text
https://<preview-domain>/api/webhooks/razorpay
```

Subscribe to `order.paid`, `payment.captured`, and `payment.failed`. Put the same signing secret in
the Preview-scoped `RAZORPAY_WEBHOOK_SECRET`.

### 4.4 Preview acceptance gate

Verify on mobile and desktop:

- Razorpay test card and test UPI success create exactly one order.
- The authoritative webhook clears the cart and triggers at most one confirmation email.
- Webhook redelivery does not duplicate orders, inventory changes, or email.
- Missing, forged, or tampered webhook signatures return 400 and write nothing.
- Underpayment and overpayment fail the in-transaction amount check.
- `payment.failed` preserves the cart and permits retry without creating a cancelled order.
- A guest order can be claimed through magic-link sign-in with the same email.
- The return page exposes neither buyer email nor total.
- PostHog receives `checkout_started`, `payment_succeeded`, and `order_completed`; GA4 and Sentry
  receive their expected events.
- The racing-green design, motion, reduced-motion behavior, and checkout UX pass visual review.

Do not proceed if any item fails. Fix, reverify, and redeploy the preview.

### 4.5 Coordinated production cutover

Production requires a new explicit approval after the preview gate passes.

The migration is incompatible with the currently deployed Stripe checkout because it renames its
columns and removes its RPCs. Prepare the application deployment, environment variables, production
test webhook, and redirect URLs first. Then perform these actions as one coordinated cutover:

1. Apply `20260712090000_razorpay_swap.sql` to the production Supabase project.
2. Immediately promote the already-green Razorpay application build.
3. Confirm the production deployment uses Razorpay **test** credentials and the production webhook.
4. Repeat the preview payment, idempotency, auth, and telemetry smoke tests on the production domain.
5. Remove Stripe variables only after Razorpay is confirmed healthy.

Record migration status, deployment URL, webhook delivery, redirect changes, telemetry evidence, and
follow-ups in `stages/04_ship/output/deploy_log.md` when operating from the master workspace.

## 5. Enabling real payments is separate

Do not accept real money as part of the initial cutover. A later explicit approval must cover:

1. Razorpay KYC and account activation.
2. A reviewed code change to the `rzp_test_` validation gate in `lib/env.ts`.
3. Live key ID, key secret, and a separate live webhook secret in Vercel Production.
4. A small real-money purchase, fulfillment-state check, and refund.

## 6. Known non-blocking residuals

- Guest-claim failure in `/auth/callback` is currently best-effort and lacks an observability event.
- A guest cart cookie may remain stale until expiry if the buyer never reaches `/checkout/return`.
- Regenerate `supabase/types.ts` from the preview branch and again from the final production schema.
- Verify a Resend sending domain and replace the sandbox sender with `orders@<domain>`.
- Revenue analytics lack a separate emitted marker for the narrow crash-after-order-commit window.

## 7. Historical references

The parent `GO-LIVE.md` and `GO-LIVE-1-data.md` are Stripe-era documents. Their Supabase security
assertion SQL remains useful, but this file supersedes their payment-provider and webhook steps.
