-- Migration: Razorpay swap — provider-neutral payment data layer (DDL).
-- Stage: 01_data (output / pending change-set). DDL ONLY — RLS enables live in rls.sql.
-- Forward-only; runs AFTER 20260707000000_claim_execute_lockdown.sql. Applied by 04_ship as
-- store/supabase/migrations/20260712090000_razorpay_swap.sql (preview/branch first, never prod
-- pre-gate). Conventions: _config/data_conventions.md (uuid PK, timestamptz, money = integer
-- minor units + currency char(3), snake_case, enums for closed sets, deliberate on-delete).
-- Reuses public.set_updated_at() (init migration) and public.apply_paid_order_effects(uuid, uuid)
-- (Slice-3 orders migration — provider-neutral already, UNCHANGED by this swap).
--
-- ============================= DESIGN (PRD Gate-1, defaults approved) =============================
-- FULL REPLACEMENT (Q5): Stripe is removed; Razorpay Standard Checkout + webhook replace it.
-- PROVIDER-NEUTRAL NAMING (Q6): payment_events (ledger), orders.provider_order_id /
-- provider_payment_id — this rename never recurs on a future provider change.
--
-- THE KEY STRUCTURAL CHANGE — first-party Checkout Session staging:
-- Stripe's hosted session carried the cart snapshot (line items, amounts, metadata) THROUGH
-- Stripe and back into the webhook. Razorpay's order object cannot (notes = 15 short key/values;
-- the same truncation risk Slice 3 explicitly rejected). So the snapshot is now staged on OUR
-- side: public.checkout_sessions — written server-side (service role) when the Razorpay Order is
-- created, read back by the webhook to write the real Order. Consequences, all deliberate:
--   * "The webhook is the ONLY writer of public.orders" (payments.md) is preserved VERBATIM —
--     orders rows are created exclusively by record_paid_order(), on an authoritative paid event.
--   * Abandoned checkouts never pollute orders/account history — they remain 'created' staging
--     rows (a cleanup job for stale rows is a later concern, not this slice).
--   * Money truth: the webhook cross-checks the paid amount against the STAGED total inside the
--     RPC transaction; a mismatch refuses the write and rolls back the ledger claim (alert loudly,
--     never "correct" money — payments.md).
--   * Razorpay `payment.failed` is NOT terminal (the shopper can retry within the same order and
--     still pay) → it only stamps failed_at telemetry on the staging row. NO 'cancelled' order is
--     written on failure — a failed/abandoned checkout simply never becomes an Order. This
--     supersedes the Stripe async_payment_failed → cancelled mapping (PRD AC2.4; flagged at gate).
--   * The Finding-#2 cart-clear guard maps over: DB carts are cleared ONLY inside
--     apply_paid_order_effects (webhook, on paid); guest cookie carts only on a server-verified
--     paid state at the return surface (02_build).
-- GST-INCLUSIVE PRICING (Q3): displayed price is final; amount_tax_minor stays 0 by design (the
-- column is retained for future explicit GST display, not dropped).

-- ---------------------------------------------------------------------------
-- 1) payment_events: provider-neutral webhook idempotency ledger (payments.md: persist processed
-- event id; duplicate retry = no-op). Natural text PK = the provider's event id (Razorpay:
-- the x-razorpay-event-id header value) — same justified deviation from uuid PKs as before:
-- the external id IS the identity being deduplicated. Replaces stripe_events (dropped in §6).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id           text        primary key,          -- provider event id (Razorpay x-razorpay-event-id)
  provider     text        not null default 'razorpay',
  type         text        not null,             -- e.g. order.paid / payment.captured / payment.failed
  processed_at timestamptz not null default now()
);
comment on table public.payment_events is
  'Processed payment-webhook event ids (idempotency ledger, payments.md). Provider-neutral (Gate-1 Q6). Insert-on-conflict-do-nothing inside the RPCs is the dedup gate. Service-role only (zero RLS policies).';

-- RLS enabled ADJACENT to creation so no default-open state ever exists (rls.sql documents
-- the zero-policy posture: enabled + no policy = no client access of any kind, intentional).
alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- 2) checkout_sessions: first-party staging of one checkout attempt (glossary: "Checkout
-- Session" — the entity existed; it was Stripe-hosted before, first-party now). Written by the
-- checkout Server Action via the service role when the Razorpay Order is created; consumed by
-- the webhook RPC to write the real Order. Holds PII (email, shipping) + the immutable items
-- snapshot → ZERO client RLS policies (rls.sql). Amounts are server-recomputed from variants
-- at creation time — never client-supplied (payments.md).
-- ---------------------------------------------------------------------------
create table if not exists public.checkout_sessions (
  id                    uuid        primary key default gen_random_uuid(),
  provider              text        not null default 'razorpay',
  provider_order_id     text        not null unique,  -- Razorpay order_… id; the webhook's lookup + idempotency key
  user_id               uuid        references auth.users (id) on delete set null, -- NULL = guest
  cart_id               uuid        references public.carts (id) on delete set null, -- NULL = guest cookie cart
  email                 text        not null,
  currency              char(3)     not null default 'INR',
  amount_subtotal_minor integer     not null check (amount_subtotal_minor >= 0),
  amount_shipping_minor integer     not null default 0 check (amount_shipping_minor >= 0),
  amount_tax_minor      integer     not null default 0 check (amount_tax_minor >= 0), -- GST-inclusive: 0 by design (Q3)
  amount_total_minor    integer     not null check (amount_total_minor >= 0),
  shipping_name         text,
  shipping_address      jsonb,      -- our own collected snapshot (same shape the receipt email reads)
  items                 jsonb       not null check (jsonb_typeof(items) = 'array'), -- order_items-shaped line snapshots
  status                text        not null default 'created' check (status in ('created', 'consumed')),
  consumed_at           timestamptz,           -- set when the webhook writes the Order
  failed_at             timestamptz,           -- payment.failed telemetry ONLY; a retry can still pay (header)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.checkout_sessions is
  'First-party staging of a checkout attempt (glossary: Checkout Session; Razorpay cannot round-trip a cart snapshot). Written server-side at Razorpay-order creation; consumed by record_paid_order(). status=created may be abandoned/failed (never becomes an Order). Zero client RLS policies.';

-- RLS enabled ADJACENT to creation (same rationale as payment_events; zero policies — PII +
-- money staging is service-role-only surface).
alter table public.checkout_sessions enable row level security;

create index if not exists checkout_sessions_created_at_idx on public.checkout_sessions (created_at);

drop trigger if exists checkout_sessions_set_updated_at on public.checkout_sessions;
create trigger checkout_sessions_set_updated_at
  before update on public.checkout_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) orders: provider-neutral linkage columns (rename preserves data, uniqueness, and the
-- lookup index through the swap; any legacy cs_…/pi_… values remain valid history).
-- ---------------------------------------------------------------------------
alter table public.orders rename column stripe_checkout_session_id to provider_order_id;
alter table public.orders rename column stripe_payment_intent_id  to provider_payment_id;
alter table public.orders rename constraint orders_stripe_checkout_session_id_key to orders_provider_order_id_key;
alter table public.orders rename constraint orders_stripe_payment_intent_id_key  to orders_provider_payment_id_key;

comment on column public.orders.provider_order_id is
  'Payment-provider order id (Razorpay order_…; legacy rows may hold Stripe cs_…). UNIQUE = the idempotent order-write key.';
comment on column public.orders.provider_payment_id is
  'Payment-provider payment id (Razorpay pay_…; legacy rows may hold Stripe pi_…).';
comment on table public.orders is
  'A purchase record, written ONLY by the payment webhook via service role (payments.md) — from the checkout_sessions staging snapshot on an authoritative paid event. user_id null = guest (email is the identity). Money in integer minor units. Unique provider_order_id makes the write retry-safe.';

-- ---------------------------------------------------------------------------
-- 4) Retire the Stripe-shaped RPCs (full replacement, Q5). apply_paid_order_effects and
-- mark_order_confirmation_email_sent are provider-neutral and stay exactly as shipped.
-- ---------------------------------------------------------------------------
drop function if exists public.record_stripe_order(text, text, jsonb, jsonb, uuid);
drop function if exists public.finalize_stripe_order(text, text, text, boolean, text, uuid);

-- ===========================================================================
-- 5a) RPC: record_paid_order — THE atomic order write, fired by the webhook on an
-- authoritative paid event (order.paid / payment.captured; both may arrive — the ledger
-- dedups the event, the unique provider_order_id dedups the order). One function = one
-- transaction: ledger claim → staged-session load (locked) → AMOUNT CROSS-CHECK → order
-- insert → item snapshots → paid effects (inventory decrement + DB-cart clear) → staging
-- consumed. Any raised error rolls ALL of it back including the ledger claim, so a Razorpay
-- redelivery gets a clean slate.
-- Returns: 'inserted' | 'duplicate_event' | 'duplicate_order' (no-op)
--        | 'session_not_found' | 'amount_mismatch' (both ROLL BACK the ledger claim —
--          caller must alert + return non-2xx so Razorpay redelivers; a mismatch is a
--          money-truth alarm, never "corrected" — payments.md).
-- security invoker + locked search_path (Slice-3 precedent); service-role EXECUTE only (§5c).
-- ===========================================================================
create or replace function public.record_paid_order(
  p_event_id            text,
  p_event_type          text,
  p_provider_order_id   text,
  p_provider_payment_id text,
  p_amount_paid_minor   integer
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cs       public.checkout_sessions%rowtype;
  v_order_id uuid;
begin
  -- Idempotency gate: first claim of this provider event id wins; a concurrent duplicate
  -- blocks on the PK until the winner commits, then lands here as a conflict.
  insert into public.payment_events (id, provider, type)
  values (p_event_id, 'razorpay', p_event_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  select * into v_cs
  from public.checkout_sessions
  where provider_order_id = p_provider_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;

  -- Money truth: the paid amount must equal the server-staged total, exactly.
  if v_cs.amount_total_minor is distinct from p_amount_paid_minor then
    raise exception using errcode = 'P0003', message = 'amount_mismatch';
  end if;

  -- Second idempotency key: a DIFFERENT paid event for the same provider order cannot double-write.
  insert into public.orders (
    user_id, email, status, currency,
    amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor,
    provider_order_id, provider_payment_id,
    shipping_name, shipping_address, paid_at
  )
  values (
    v_cs.user_id, v_cs.email, 'paid', v_cs.currency,
    v_cs.amount_subtotal_minor, v_cs.amount_shipping_minor, v_cs.amount_tax_minor,
    v_cs.amount_total_minor,
    v_cs.provider_order_id, nullif(p_provider_payment_id, ''),
    v_cs.shipping_name, v_cs.shipping_address, now()
  )
  on conflict (provider_order_id) do nothing
  returning id into v_order_id;
  if v_order_id is null then
    return 'duplicate_order';
  end if;

  insert into public.order_items (
    order_id, variant_id, product_title, variant_title, sku,
    unit_price_minor, quantity, line_total_minor, currency
  )
  select
    v_order_id,
    nullif(i->>'variant_id', '')::uuid,
    i->>'product_title',
    i->>'variant_title',
    nullif(i->>'sku', ''),
    (i->>'unit_price_minor')::integer,
    (i->>'quantity')::integer,
    (i->>'line_total_minor')::integer,
    coalesce(i->>'currency', 'INR')
  from jsonb_array_elements(v_cs.items) as i;

  perform public.apply_paid_order_effects(v_order_id, v_cs.cart_id);

  update public.checkout_sessions
  set status = 'consumed', consumed_at = now()
  where id = v_cs.id;

  return 'inserted';
exception
  when sqlstate 'P0002' then
    return 'session_not_found';
  when sqlstate 'P0003' then
    return 'amount_mismatch';
end;
$$;

-- ===========================================================================
-- 5b) RPC: mark_checkout_failed — payment.failed TELEMETRY. Stamps failed_at on the staging
-- row; deliberately does NOT cancel anything (a retry within the same Razorpay order can
-- still pay — see header). Returns 'marked' | 'duplicate_event' | 'already_consumed'
-- (benign no-op: a stale failed event after the order was paid) | 'session_not_found'
-- (ROLLS BACK the ledger claim — unknown order id; caller alerts + non-2xx).
-- ===========================================================================
create or replace function public.mark_checkout_failed(
  p_event_id          text,
  p_event_type        text,
  p_provider_order_id text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cs public.checkout_sessions%rowtype;
begin
  insert into public.payment_events (id, provider, type)
  values (p_event_id, 'razorpay', p_event_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  select * into v_cs
  from public.checkout_sessions
  where provider_order_id = p_provider_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;

  if v_cs.status = 'consumed' then
    return 'already_consumed';
  end if;

  update public.checkout_sessions
  set failed_at = now()
  where id = v_cs.id;

  return 'marked';
exception
  when sqlstate 'P0002' then
    return 'session_not_found';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5c) EXECUTE lockdown — adjacent to the DDL so no state ever exists where client roles can
-- call these (functions default to PUBLIC execute). Service role only: the payments.md
-- server-only write path. (apply_paid_order_effects keeps its existing shipped lockdown.)
-- ---------------------------------------------------------------------------
revoke execute on function public.record_paid_order(text, text, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.mark_checkout_failed(text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_paid_order(text, text, text, text, integer) to service_role;
grant execute on function public.mark_checkout_failed(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6) Drop the Stripe ledger LAST (after the functions that referenced it are gone).
-- Deliberate hard drop (full replacement, Q5): the Stripe webhook endpoint is being
-- deregistered; no code path can ever consult evt_… history again.
-- ---------------------------------------------------------------------------
drop table if exists public.stripe_events;
