-- Migration: Slice 3 checkout+payments â€” orders / order_items / stripe_events + order-write RPCs (DDL).
-- Stage: 01_data (output / pending change-set). DDL ONLY â€” RLS policies live in rls.sql.
-- Forward-only; runs AFTER 20260702000000_cart.sql. Applied (combined w/ rls.sql) by 04_ship as
-- store/supabase/migrations/20260702120000_orders.sql (preview/branch first, never prod pre-gate).
-- Conventions: _config/data_conventions.md (uuid PK, timestamptz, money = integer minor units +
-- currency char(3), snake_case, enums for closed sets, deliberate on-delete).
-- Reuses public.set_updated_at() (defined in the init migration) â€” not redefined here.
--
-- WRITE-PATH DECISION (PRD + _config/payments.md): the Stripe webhook is the ONLY writer of order
-- state, via the service role. No client role ever inserts/updates these tables (see rls.sql).
-- The write itself happens through the two RPCs below â€” one plpgsql function = one transaction â€”
-- because supabase-js has no client-side transactions and the webhook write must be atomic
-- (event ledger + order + items + inventory + cart-clear commit or roll back together).
--
-- GUEST ORDERS (Gate-1 confirmed): user_id is NULLABLE â€” null = guest purchase, identified by
-- email captured from the Stripe session. Claim-by-verified-email is Slice 4; the lower(email)
-- index below is its foundation.

-- order lifecycle â€” closed set (domain_glossary: pending â†’ paid â†’ fulfilled â†’ refunded/cancelled).
create type public.order_status as enum
  ('pending', 'paid', 'fulfilled', 'refunded', 'cancelled');

-- ---------------------------------------------------------------------------
-- orders: the persisted record of a purchase (glossary: "Order") â€” written by the
-- Stripe webhook only. Keyed 1:1 to the Stripe Checkout Session (unique) so a
-- retried/duplicated event can never double-write (payments.md idempotency).
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     uuid        references auth.users (id) on delete set null, -- NULL = guest
  email                       text        not null,  -- session.customer_details.email (guest identity / Slice-4 claim)
  status                      public.order_status not null default 'pending',
  currency                    char(3)     not null default 'INR',
  amount_subtotal_minor       integer     not null check (amount_subtotal_minor >= 0),
  amount_shipping_minor       integer     not null default 0 check (amount_shipping_minor >= 0),
  amount_tax_minor            integer     not null default 0 check (amount_tax_minor >= 0),   -- 0 when the Stripe-Tax fallback fired (Gate-1 #1)
  amount_total_minor          integer     not null check (amount_total_minor >= 0),
  stripe_checkout_session_id  text        not null unique,  -- idempotent order key (doubles as the finalize lookup index)
  stripe_payment_intent_id    text        unique,           -- null until paid (async flows fill it at finalize)
  shipping_name               text,                          -- Stripe-collected snapshot (Gate-1 #3)
  shipping_address            jsonb,                         -- Stripe address object snapshot (Gate-1 #3)
  paid_at                     timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
comment on table public.orders is
  'A purchase record, written ONLY by the Stripe webhook via service role (payments.md). user_id null = guest (email is the identity). Money in integer minor units. Unique stripe_checkout_session_id makes order creation retry-safe.';

create index if not exists orders_user_id_idx on public.orders (user_id);
-- Slice-4 guest-claim foundation: look up a guest''s orders by verified email, case-insensitive.
create index if not exists orders_email_lower_idx on public.orders (lower(email));

-- ---------------------------------------------------------------------------
-- order_items: immutable snapshot of one purchased line (glossary: "Order line item") â€”
-- variant + qty + unit price AT PURCHASE TIME. Denormalized titles/sku so the record
-- survives later catalog edits; variant_id is on-delete SET NULL so it survives deletes.
-- Append-only: NO updated_at and no trigger (deliberate deviation, recorded for 03_verify).
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id               uuid        primary key default gen_random_uuid(),
  order_id         uuid        not null references public.orders (id) on delete cascade,
  variant_id       uuid        references public.variants (id) on delete set null,
  product_title    text        not null,
  variant_title    text        not null,
  sku              text,
  unit_price_minor integer     not null check (unit_price_minor >= 0),
  quantity         integer     not null check (quantity >= 1),
  line_total_minor integer     not null check (line_total_minor >= 0),
  currency         char(3)     not null default 'INR',
  created_at       timestamptz not null default now()
);
comment on table public.order_items is
  'Immutable snapshot of variant + qty + unit price at purchase time (glossary). Denormalized titles survive catalog changes; append-only (no updated_at by design).';

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- stripe_events: webhook idempotency ledger (payments.md: persist processed event.id;
-- duplicate retry = no-op). Natural text PK = the Stripe event id (evt_â€¦) â€” justified
-- deviation from uuid PKs: the external id IS the identity being deduplicated.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id           text        primary key,  -- Stripe event id (evt_â€¦)
  type         text        not null,
  processed_at timestamptz not null default now()
);
comment on table public.stripe_events is
  'Processed Stripe webhook event ids (idempotency ledger, payments.md). Insert-on-conflict-do-nothing is the dedup gate inside the order-write RPCs. Service-role access only (zero RLS policies).';

-- updated_at trigger â€” orders only (order_items is append-only; stripe_events has processed_at).
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RPC 1: record_stripe_order â€” the atomic order write for checkout.session.completed.
-- One function = one transaction: event-ledger claim â†’ order insert â†’ item snapshots â†’
-- (when paid) inventory decrement + DB-cart clear. Any raised error rolls ALL of it back,
-- including the event-ledger row, so a Stripe retry gets a clean slate (payments.md).
-- Returns: 'inserted' | 'duplicate_event' | 'duplicate_order' (both duplicates = caller no-ops).
-- security invoker + locked search_path (init-migration precedent); only the service role
-- may execute (revokes below) â€” this is the payments.md server-only write path.
-- ===========================================================================
create or replace function public.record_stripe_order(
  p_event_id   text,
  p_event_type text,
  p_order      jsonb,
  p_items      jsonb,
  p_cart_id    uuid default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status   public.order_status;
  v_order_id uuid;
begin
  -- Idempotency gate: first claim of this Stripe event id wins; a concurrent duplicate
  -- blocks on the PK until the winner commits, then lands here as a conflict.
  insert into public.stripe_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  v_status := (p_order->>'status')::public.order_status;

  -- Second idempotency key: a DIFFERENT event for the same session still cannot double-write.
  insert into public.orders (
    user_id, email, status, currency,
    amount_subtotal_minor, amount_shipping_minor, amount_tax_minor, amount_total_minor,
    stripe_checkout_session_id, stripe_payment_intent_id,
    shipping_name, shipping_address, paid_at
  )
  values (
    nullif(p_order->>'user_id', '')::uuid,
    p_order->>'email',
    v_status,
    coalesce(p_order->>'currency', 'INR'),
    (p_order->>'amount_subtotal_minor')::integer,
    coalesce((p_order->>'amount_shipping_minor')::integer, 0),
    coalesce((p_order->>'amount_tax_minor')::integer, 0),
    (p_order->>'amount_total_minor')::integer,
    p_order->>'stripe_checkout_session_id',
    nullif(p_order->>'stripe_payment_intent_id', ''),
    nullif(p_order->>'shipping_name', ''),
    nullif(p_order->'shipping_address', 'null'::jsonb),
    case when v_status = 'paid' then now() end
  )
  on conflict (stripe_checkout_session_id) do nothing
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
  from jsonb_array_elements(p_items) as i;

  if v_status = 'paid' then
    perform public.apply_paid_order_effects(v_order_id, p_cart_id);
  end if;

  return 'inserted';
end;
$$;

-- ===========================================================================
-- RPC 2: finalize_stripe_order â€” async-payment transitions (Gate-1 #2):
-- checkout.session.async_payment_succeeded â†’ pendingâ†’paid (+ paid effects);
-- checkout.session.async_payment_failed   â†’ pendingâ†’cancelled.
-- Same event-id idempotency gate. Returns 'finalized' | 'duplicate_event' |
-- 'order_not_pending' â€” the last covers BOTH "order row not written yet" (out-of-order
-- delivery: caller should 500 so Stripe redelivers after session.completed lands) and
-- "already transitioned" (caller no-ops); the caller disambiguates by looking the order up.
-- ===========================================================================
create or replace function public.finalize_stripe_order(
  p_event_id          text,
  p_event_type        text,
  p_session_id        text,
  p_paid              boolean,
  p_payment_intent_id text default null,
  p_cart_id           uuid default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  insert into public.stripe_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  update public.orders
  set status                   = case when p_paid then 'paid' else 'cancelled' end::public.order_status,
      paid_at                  = case when p_paid then now() end,
      stripe_payment_intent_id = coalesce(nullif(p_payment_intent_id, ''), stripe_payment_intent_id)
  where stripe_checkout_session_id = p_session_id
    and status = 'pending'
  returning id into v_order_id;
  if v_order_id is null then
    -- Roll back the event-ledger claim too: if this is out-of-order delivery, the retry
    -- (after session.completed writes the pending order) must be allowed to process.
    raise exception using errcode = 'P0002', message = 'order_not_pending';
  end if;

  if p_paid then
    perform public.apply_paid_order_effects(v_order_id, p_cart_id);
  end if;

  return 'finalized';
exception
  when sqlstate 'P0002' then
    return 'order_not_pending';
end;
$$;

-- ===========================================================================
-- Shared paid-order side effects: decrement inventory (floored at 0) from the order''s
-- own immutable item snapshots, and clear the purchaser''s DB cart (guest carts are
-- cookie-resident â€” cleared on the return surface, not here).
-- ===========================================================================
create or replace function public.apply_paid_order_effects(
  p_order_id uuid,
  p_cart_id  uuid default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.variants v
  set inventory_count = greatest(v.inventory_count - s.qty, 0)
  from (
    select oi.variant_id, sum(oi.quantity)::integer as qty
    from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id
  ) s
  where v.id = s.variant_id;

  if p_cart_id is not null then
    delete from public.cart_items where cart_id = p_cart_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE lockdown â€” kept adjacent to the function DDL so no state ever exists where the
-- functions are callable by client roles (functions default to PUBLIC execute in Postgres).
-- The service role keeps execute: this is the payments.md server-only order-write path.
-- ---------------------------------------------------------------------------
revoke execute on function public.record_stripe_order(text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.finalize_stripe_order(text, text, text, boolean, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.apply_paid_order_effects(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_stripe_order(text, text, jsonb, jsonb, uuid) to service_role;
grant execute on function public.finalize_stripe_order(text, text, text, boolean, text, uuid) to service_role;
grant execute on function public.apply_paid_order_effects(uuid, uuid) to service_role;

-- ============================================================================
-- RLS (from stages/01_data/output/rls.sql)
-- ============================================================================

-- RLS: Slice 3 checkout+payments â€” orders are READ-ONLY to their owner; NOTHING is client-writable.
-- Stage: 01_data (output / pending change-set). Pairs with migration.sql.
-- Rule (_config/security_shield.md flaw #2 + data_conventions.md): every new table has RLS enabled
-- and is DEFAULT-DENY; ownership is scoped to auth.uid().
--
-- WRITE POSTURE (payments.md): the Stripe webhook â€” via the service role, which bypasses RLS by
-- design â€” is the ONLY writer of order state. There are deliberately NO insert/update/delete
-- policies for ANY client role on ANY table below, and none may ever be added ("never mutate paid
-- orders from client actions"). Function EXECUTE lockdown for the order-write RPCs lives next to
-- their DDL in migration.sql (privileges, not policies).
--
-- GUEST ORDERS (user_id IS NULL) are invisible to every client by default-deny arithmetic:
-- the anon role has no policy at all, and for authenticated callers the select predicate
-- `(select auth.uid()) = user_id` evaluates NULL when user_id is NULL â†’ not TRUE â†’ denied.
-- No extra policy is needed; guests reach their order via claim-by-verified-email in Slice 4.
--
-- order_items are scoped by PARENT-order ownership via an EXISTS subquery â€” the same
-- child-scoping posture as Slice 2''s cart_items. auth.uid() is wrapped as (select auth.uid())
-- per the init-migration precedent (stable + faster).

-- ---------------------------------------------------------------------------
-- orders: SELECT own rows only. No client write policies â€” ever.
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
  on public.orders for select
  using ( (select auth.uid()) = user_id );

-- ---------------------------------------------------------------------------
-- order_items: SELECT allowed ONLY when the parent order belongs to the caller.
-- No client write policies â€” snapshots are immutable and webhook-written.
-- ---------------------------------------------------------------------------
alter table public.order_items enable row level security;

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- stripe_events: ZERO policies â€” RLS enabled with no policy means NO client access of any
-- kind (intentional; data_conventions.md "a table with no policy = no access"). Only the
-- service role (bypasses RLS) touches the idempotency ledger, inside the order-write RPCs.
-- ---------------------------------------------------------------------------
alter table public.stripe_events enable row level security;

