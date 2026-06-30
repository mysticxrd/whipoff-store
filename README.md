# Whipoff — store (inner Next.js app)

The deployable Whipoff car-care storefront — the durable artifact built by the outer **MWP
factory** in `..` (this is a **separate git root**). Stack: **Next.js 16** (App Router, RSC +
Server Actions), **TypeScript** (strict), **Tailwind v4**, **shadcn/ui**, **Supabase**
(Postgres/Auth), with **Sentry** + **PostHog**.

## Local dev
```bash
pnpm install
cp .env.example .env.local    # placeholders are fine; fill real keys when available
pnpm dev                       # http://localhost:3000
```
Slice 0 (the walking skeleton) boots **green with placeholder env values**. Real
Supabase/Vercel/Sentry/PostHog provisioning is the **deferred deploy runbook**
(`../stages/04_ship/output/deploy_log.md`).

## Conventions (authoritative — live in the factory, not here)
- `../_config/` — tech stack, data conventions, **security shield**, payments, design system,
  email, observability, MCP targets.
- `../shared/` — domain glossary, API conventions.
- **Edit-Source:** don't hand-patch generated code — fix the contract/_config and re-run the
  stage.

## Scripts
`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm lint` · `pnpm typecheck` · `pnpm test`
