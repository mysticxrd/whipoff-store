-- Migration: Slice 2 cart — carts / cart_items (DDL + RLS combined, matching the Slice-0/1 precedent).
-- Forward-only; runs AFTER 20260630010000_catalog.sql.
-- Conventions: data_conventions.md (uuid PK, timestamptz, snake_case). Money is NOT stored on cart
-- lines — unit price is recomputed server-side from variants at read/checkout time
-- (domain_glossary "Cart": prices recomputed server-side, never trusted from the client).
-- Reuses public.set_updated_at() (defined in the init migration) — not redefined here.
--
-- SCOPE DECISION (Checkpoint A, confirmed): public.carts persists an AUTHENTICATED customer's
-- cart only. A GUEST cart lives in a server-managed httpOnly cookie (no DB row, nothing for RLS
-- to expose) and is MERGED into public.carts (quantities SUMMED per variant) by a Server Action on
-- sign-in. This keeps guest carts RLS-risk-free (no anon policy, no service-role for routine cart
-- ops) and lets the local-first build run the cart with zero database (the guest-cookie path IS
-- the local path).

-- ---------------------------------------------------------------------------
-- carts: an authenticated customer's in-progress selection (glossary: "Cart").
-- Exactly ONE open cart per user (unique user_id) — the merge target on sign-in.
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.carts is
  'An authenticated customer''s in-progress cart (one per user). Guest carts are httpOnly-cookie resident and merged in on sign-in — see the RLS section below.';

-- ---------------------------------------------------------------------------
-- cart_items: one variant + quantity within a cart (glossary: "Cart line item").
-- NO price column — unit price is read live from variants server-side (never trusted from the
-- client; security_shield flaw #3). One line per variant via unique (cart_id, variant_id): adding
-- a variant already in the cart increments its quantity instead of duplicating the line.
-- ---------------------------------------------------------------------------
create table if not exists public.cart_items (
  id         uuid        primary key default gen_random_uuid(),
  cart_id    uuid        not null references public.carts (id)    on delete cascade,
  variant_id uuid        not null references public.variants (id) on delete cascade,
  quantity   integer     not null default 1 check (quantity >= 1 and quantity <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
comment on table public.cart_items is
  'One variant + quantity within a cart. No stored price (recomputed server-side from variants). Unique (cart_id, variant_id): re-adding a variant increments quantity. quantity capped [1,99].';
-- Note: the unique (cart_id, variant_id) index also covers cart_id-prefixed lookups, so no
-- separate cart_id index is needed (unlike the Slice-1 catalog child tables).

-- updated_at triggers — reuse public.set_updated_at() from the init migration.
drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a cart and its items are readable/writable ONLY by their owner (security_shield.md #2).
-- No public/anon policy — a cart is PRIVATE, unlike the Slice-1 catalog tables. cart_items are
-- scoped by PARENT-cart ownership via an EXISTS subquery, the same child-scoping posture locked
-- in for Slice 1's catalog child tables. auth.uid() wrapped as (select auth.uid()) per precedent.
-- ---------------------------------------------------------------------------
alter table public.carts enable row level security;

drop policy if exists carts_select_own on public.carts;
create policy carts_select_own
  on public.carts for select
  using ( (select auth.uid()) = user_id );

drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own
  on public.carts for insert
  with check ( (select auth.uid()) = user_id );

drop policy if exists carts_update_own on public.carts;
create policy carts_update_own
  on public.carts for update
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own
  on public.carts for delete
  using ( (select auth.uid()) = user_id );

alter table public.cart_items enable row level security;

drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own
  on public.cart_items for select
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own
  on public.cart_items for insert
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
  on public.cart_items for update
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
  on public.cart_items for delete
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );
