-- Migration: Slice 4 account + order history + guest order claim (DDL).
-- Stage: 01_data (output / pending change-set). DDL ONLY — RLS lives in rls.sql.
-- Forward-only; runs AFTER 20260702120000_orders.sql. Applied (combined w/ rls.sql) by 04_ship as
-- store/supabase/migrations/20260703120000_slice4_account.sql (preview/branch first, never prod pre-gate).
-- Conventions: _config/data_conventions.md (uuid PK, timestamptz, money = integer minor units,
-- snake_case, deliberate on-delete). Reuses public.set_updated_at() (init migration) — not redefined.
--
-- WHAT THIS SLICE ADDS (and, deliberately, what it does NOT):
--   * NO new tables. The account read side rides entirely on Slice 3's orders / order_items,
--     whose owner-scoped SELECT policies ALREADY EXIST (rls.sql documents this). No profile
--     entity (PRD Gate-1 #6): the account reads auth.users + orders.email directly.
--   * orders.user_id (nullable, guest=null) and orders_email_lower_idx already exist from Slice 3
--     — Slice 3 labelled that index "the Slice-4 guest-claim foundation". We do NOT re-add them.
--   * NEW #1: orders.order_seq — a monotonic sequence backing the human-readable order number
--     WO-###### (PRD Gate-1 #3). DISPLAY-ONLY: the uuid PK stays the identity; the number is
--     NEVER an access token (RLS gates ownership, not the number). Formatting (WO- + zero-pad)
--     is a pure app helper in contracts.ts (formatOrderNumber) so it is unit-testable offline
--     (PRD Gate-1 #5 mock posture).
--   * NEW #2: claim_guest_orders() — the guest-claim write path (PRD Gate-1 #2). See its header.
--
-- WRITE-PATH INVARIANT (payments.md, reaffirmed): the Stripe webhook (service role) stays the
-- ONLY writer of order money/status/line snapshots. The claim function below is the sole new
-- write, and it touches ONLY the null ownership pointer (user_id) of the caller's OWN
-- verified-email orders — never money, status, lines, or shipping.

-- ===========================================================================
-- NEW #1 — human-readable order number (WO-######) backed by a monotonic sequence.
-- ===========================================================================
create sequence if not exists public.order_number_seq;

alter table public.orders
  add column if not exists order_seq bigint;

-- Backfill existing (Slice-3) orders in creation order so numbering is stable & chronological.
update public.orders o
set order_seq = n.rn
from (
  select id, row_number() over (order by created_at, id) as rn
  from public.orders
  where order_seq is null
) n
where o.id = n.id
  and o.order_seq is null;

-- Advance the sequence past the highest backfilled value so future defaults never collide.
-- is_called = true ⇒ the next nextval() returns max+1 (or 1 when the table is empty).
select setval('public.order_number_seq', coalesce((select max(order_seq) from public.orders), 0), true);

-- New webhook-written orders get their number automatically via the column default — Slice 3's
-- record_stripe_order insert never names order_seq, so this default fills it with no code change.
alter table public.orders
  alter column order_seq set default nextval('public.order_number_seq');

-- Tie the sequence's lifecycle to the column (dropped together; owner is the table).
alter sequence public.order_number_seq owned by public.orders.order_seq;

-- Now that every row has a value and new rows default, enforce presence + uniqueness.
alter table public.orders
  alter column order_seq set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_order_seq_key') then
    alter table public.orders add constraint orders_order_seq_key unique (order_seq);
  end if;
end
$$;

comment on column public.orders.order_seq is
  'Monotonic source of the display order number WO-###### (contracts.ts formatOrderNumber). DISPLAY ONLY — never an access/authorization token; RLS gates ownership. Auto-filled on insert via order_number_seq default.';

-- ===========================================================================
-- NEW #2 — claim_guest_orders(): the guest-claim write path (PRD Gate-1 #2).
--
-- SECURITY MODEL (why this is safe despite being client-callable):
--   * PARAMETERLESS. The match key is the VERIFIED session email read from the JWT
--     (auth.email()), NOT a client argument — so a caller can only ever claim orders whose
--     captured email equals THEIR OWN authenticated mailbox. Supplying an email / order number
--     you don't control is structurally impossible (there is no such input). This is the
--     PRD's "authenticating IS proof of mailbox control".
--   * SELF-SCOPED + NON-STEALING. Updates ONLY rows where user_id IS NULL (an already-claimed
--     order is never re-owned) AND the ASCII-whitespace-trimmed, lowercased email = the
--     identically normalized verified session email.
--   * OWNERSHIP-ONLY. Sets user_id and nothing else — money, status, snapshots, shipping are
--     untouched (PRD: claimed orders stay immutable; payments.md write-path invariant holds).
--   * IDEMPOTENT. Re-running claims nothing new (rows are no longer NULL after the first run).
--   * SECURITY DEFINER + locked search_path (Slice-3 precedent) so it may bypass the orders
--     write-deny RLS, but EXECUTE is granted to `authenticated` ONLY (never anon) — an
--     unauthenticated / anonymous session cannot invoke it (guards below double-check).
--   Normalization is ALIGNED with contracts.ts normalizeEmail (lower + trim) for the ASCII-clean
--   inputs we accept (Stripe/GoTrue emails): both strip the full ASCII whitespace set + lowercase.
--   Accepted residual (03_verify Finding 2): JS trim() also strips Unicode whitespace and
--   toLowerCase() can diverge from lower() on locale glyphs — unreachable with provider emails.
-- Returns: count of orders newly attached (drives the "we found N past orders" acknowledgement).
-- ===========================================================================
create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  -- Whitespace set matches JS String.trim()'s ASCII subset (space \t \n \r \f \v) so the
  -- matcher agrees with contracts.ts normalizeEmail on ASCII-clean inputs (Gate-4 Finding-2).
  v_email   text    := lower(btrim(auth.email(), E' \t\n\r\f\x0B'));
  v_claimed integer := 0;
begin
  -- Require an authenticated, non-anonymous session carrying a verified email identity.
  if v_uid is null or v_email is null or v_email = '' then
    return 0;
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return 0;
  end if;
  -- Verified-email gate — authoritative source + default-deny. auth.users.email_confirmed_at
  -- is written only by GoTrue on successful verification; unlike the user_metadata JWT claim
  -- (client-writable via updateUser), no client API can set it. Readable here because
  -- SECURITY DEFINER runs as the function owner. Missing row / NULL → deny (return 0).
  if not exists (
    select 1
    from auth.users u
    where u.id = v_uid
      and u.email_confirmed_at is not null
  ) then
    return 0;
  end if;

  update public.orders o
  set user_id = v_uid
  where o.user_id is null
    and lower(btrim(o.email, E' \t\n\r\f\x0B')) = v_email;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

comment on function public.claim_guest_orders() is
  'Guest-claim (PRD Slice-4 Gate-1 #2): attaches the caller''s OWN unclaimed orders — matched by verified JWT email (auth.email()), not a client argument — to their account. Parameterless, self-scoped, non-stealing (user_id IS NULL only), ownership-only, idempotent. SECURITY DEFINER to bypass the orders write-deny RLS; EXECUTE granted to authenticated only.';

-- EXECUTE lockdown — kept adjacent to the function DDL (Slice-3 precedent: privileges, not
-- policies). Functions default to PUBLIC execute in Postgres, so revoke first, then grant to
-- authenticated ONLY. anon can never claim; service_role has no user JWT (no auth.email()) so it
-- is intentionally not granted — the claim is meaningful only under a user session.
revoke execute on function public.claim_guest_orders() from public, anon;
grant execute on function public.claim_guest_orders() to authenticated;

-- ==== RLS (from rls.sql) ====
-- RLS: Slice 4 account + order history + guest order claim.
-- Stage: 01_data (output / pending change-set). Pairs with migration.sql.
-- Rule (_config/security_shield.md flaw #2 + data_conventions.md): every table has RLS enabled and
-- is DEFAULT-DENY; ownership is scoped to auth.uid().
--
-- NO NEW TABLES THIS SLICE, therefore NO new policies. This file is deliberately (near-)empty and
-- is here to make that an EXPLICIT, reviewable decision rather than an omission — the account read
-- side rides entirely on policies Slice 3 shipped ANTICIPATING this slice:
--
--   * orders.orders_select_own            → SELECT using ( (select auth.uid()) = user_id )
--   * order_items.order_items_select_own  → SELECT where the PARENT order belongs to the caller
--
-- These become LOAD-BEARING for the first time now: until Slice 4 there was no authenticated
-- session to satisfy auth.uid(). A guest/unclaimed order (user_id IS NULL) still denies by NULL
-- arithmetic ((select auth.uid()) = NULL is never TRUE) — it becomes visible ONLY after the
-- claim function sets user_id to the verified owner. Order history therefore needs no new policy;
-- the existing owner-scoped SELECT is exactly right. (Verified again in 03_verify against the live
-- migration; not re-declared here to keep the forward-only change-set additive and unambiguous.)
--
-- NEW COLUMN, NO NEW SURFACE: orders.order_seq (the WO-###### source) is a column on an
-- already-RLS'd table, so it inherits orders' row policies — it is readable exactly when its row
-- is, and is display-only (never an access token). No column/table policy change is needed.
--
-- THE ONE NEW WRITE PATH — claim_guest_orders() — is NOT an RLS policy and adds none:
--   * It is a SECURITY DEFINER function that BYPASSES RLS BY DESIGN (migration.sql), the same
--     shape as Slice 3's service-role order-write RPCs — a server-defined, guarded code path, not
--     a client-writable row policy. Slice 3's standing rule "NO insert/update/delete policies for
--     any client role on orders, ever" is therefore UNCHANGED and remains true.
--   * Its safety is enforced in the function body + its EXECUTE grant (authenticated only), NOT by
--     a policy: parameterless, matched on the verified JWT email, user_id-IS-NULL-only,
--     ownership-only, idempotent. See the function header in migration.sql.
--
-- NET: no table is default-open, no new default-open surface is introduced, and no existing
-- write-deny posture is loosened. The security_shield flaw-#2 gate is satisfied vacuously for new
-- tables (there are none) and affirmatively for the tables this slice reads.

-- (Intentionally no executable statements. Re-enabling RLS on the Slice-3 tables here would be a
-- redundant no-op; the policies above are owned by the 20260702 change-set and remain in force.)
