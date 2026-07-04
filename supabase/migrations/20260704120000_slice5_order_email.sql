-- ============================================================================
-- Migration 20260704120000 — Slice 5: order-confirmation email (Resend).
-- Combined at 04_ship from the reviewed 01_data change-set:
--   stages/01_data/output/migration.sql  (DDL: marker column + mark RPC)
--   stages/01_data/output/rls.sql        (RLS: documented no-op — no new tables)
-- Forward-only; runs AFTER 20260703120000_slice4_account.sql.
-- NOT applied locally (no DB on this box); apply preview/branch-first per the
-- Slice-5 deploy_log runbook, never prod pre-gate.
-- ============================================================================


-- === migration.sql (DDL) ====================================================
-- Migration: Slice 5 order-confirmation email (Resend) — idempotency marker + mark RPC (DDL).
-- Stage: 01_data (output / pending change-set). DDL ONLY — RLS notes live in rls.sql.
-- Forward-only; runs AFTER 20260703120000_slice4_account.sql. Applied (combined w/ rls.sql) by
-- 04_ship as store/supabase/migrations/20260704120000_slice5_order_email.sql (preview/branch first,
-- never prod pre-gate). Conventions: _config/data_conventions.md (timestamptz; integer minor-unit
-- money is untouched here; snake_case). Reuses public.set_updated_at() (init migration) — not redefined.
--
-- WHAT THIS SLICE ADDS (and, deliberately, what it does NOT):
--   * NO new tables. The confirmation email rides entirely on Slice 3's orders / order_items,
--     read by the service role in the EXISTING Stripe webhook path. RLS is UNCHANGED (rls.sql
--     documents this). No new client surface, no new client-writable anything.
--   * NEW #1: orders.confirmation_email_sent_at — the exactly-once idempotency marker for the
--     order-confirmation email (PRD Slice-5 Gate-1 #3: "simple marker on the Order"). NULL = not
--     yet sent; a timestamp = recorded sent. Nullable BY DESIGN — NULL is the "needs sending"
--     signal — so no default and no NOT NULL (contrast order_seq, which is display data on every row).
--   * NEW #2: mark_order_confirmation_email_sent() — the service-role-only setter that records a
--     send. Atomic NULL-guarded claim; see its header for the crash-ordering model.
--
-- WRITE-PATH INVARIANT (payments.md, reaffirmed): the Stripe webhook (service role) stays the ONLY
-- writer of order state. The marker is written ONLY through the service-role function below (EXECUTE
-- revoked from every client role) — NO client role, and NO RLS policy, may set it. The marker touches
-- neither money, status, line snapshots, nor shipping — only the send-bookkeeping timestamp.
--
-- IDEMPOTENCY / CRASH MODEL (PRD Slice-5 Gate-1 #4 + #5 — "prefer-delivery"): the webhook SENDS the
-- email first, THEN calls the setter. The marker dedups the COMMON case — a later Stripe retry reads
-- the marker non-NULL and does NOT re-send. A crash BETWEEN send and mark leaves it NULL, so a retry
-- RE-SENDS (a rare duplicate) rather than dropping the receipt — deliberately preferring delivery over
-- at-most-once (a missing receipt erodes trust more than a duplicate). This dedup is SEPARATE from the
-- stripe_events ledger (which dedups the ORDER WRITE): the two can fail independently, so the email
-- needs its own marker rather than riding the event-id gate (which would make a crash-before-send a
-- permanently missed receipt).

-- ---------------------------------------------------------------------------
-- NEW #1 — confirmation-email idempotency marker on the existing orders table.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'Order-confirmation email idempotency marker (PRD Slice-5). NULL = not yet sent; timestamp = recorded sent by mark_order_confirmation_email_sent() in the webhook path. Written ONLY by the service role; never client-writable. Not money/status/authz — just send bookkeeping.';

-- Backfill: treat every ALREADY-PAID order as already-confirmed so ACTIVATING this feature never
-- retroactively emails historical purchasers. paid_at is the meaningful "as-of" — every order that
-- reached 'paid' has it (record_stripe_order / finalize_stripe_order set it at the paid transition).
-- Orders never paid keep NULL, so they email correctly if/when a later async transition pays them.
-- (Same backfill-existing-rows discipline as Slice 4's order_seq; a one-time updated_at bump on
-- historical rows is acceptable.)
update public.orders
set confirmation_email_sent_at = paid_at
where paid_at is not null
  and confirmation_email_sent_at is null;

-- ===========================================================================
-- NEW #2 — mark_order_confirmation_email_sent(): record that the confirmation email was sent.
-- Atomic claim: sets the marker ONLY where it is still NULL, so concurrent/duplicate webhook
-- deliveries cannot double-count. Returns TRUE iff THIS call set it (the caller newly recorded a
-- send) — useful for observability/tests; correctness does NOT depend on the return, since the
-- webhook's decision to send is gated by reading confirmation_email_sent_at during its own
-- service-role SELECT (prefer-delivery: send THEN mark).
-- security invoker + locked search_path (Slice-3 RPC precedent): runs as the service role, which
-- bypasses RLS by design; EXECUTE is revoked from every client role below (server-only write path).
-- ===========================================================================
create or replace function public.mark_order_confirmation_email_sent(p_order_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  update public.orders
  set confirmation_email_sent_at = now()
  where id = p_order_id
    and confirmation_email_sent_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

comment on function public.mark_order_confirmation_email_sent(uuid) is
  'Records that an order-confirmation email was sent (PRD Slice-5). Atomic claim (sets orders.confirmation_email_sent_at only where NULL); returns TRUE iff this call set it. Service-role only (EXECUTE revoked from client roles) — the webhook''s prefer-delivery send-then-mark step. Never touches money/status/lines.';

-- EXECUTE lockdown — adjacent to the DDL (Slice-3/4 precedent: privileges, not policies). Functions
-- default to PUBLIC execute in Postgres, so revoke from all client roles first, then grant to
-- service_role ONLY. anon/authenticated can never mark an email sent — the marker is part of the
-- server-only order write-path (payments.md); a user session has no business writing order bookkeeping.
revoke execute on function public.mark_order_confirmation_email_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_confirmation_email_sent(uuid) to service_role;


-- === rls.sql (RLS — documented no-op) =======================================
-- RLS: Slice 5 order-confirmation email (Resend).
-- Stage: 01_data (output / pending change-set). Pairs with migration.sql.
-- Rule (_config/security_shield.md flaw #2 + data_conventions.md): every table has RLS enabled and
-- is DEFAULT-DENY; ownership is scoped to auth.uid().
--
-- NO NEW TABLES THIS SLICE, therefore NO new policies. This file is deliberately (near-)empty and is
-- here to make that an EXPLICIT, reviewable decision rather than an omission. Everything Slice 5 adds
-- sits on Slice 3's already-RLS'd orders table:
--
--   * NEW COLUMN, NO NEW SURFACE: orders.confirmation_email_sent_at is a column on an already-RLS'd
--     table, so it inherits orders' row policies (orders_select_own) — the owner can read it exactly
--     when they can read their own order row; guest/unclaimed orders (user_id IS NULL) stay denied by
--     NULL arithmetic ((select auth.uid()) = NULL is never TRUE). It is a send-bookkeeping timestamp,
--     NOT sensitive and NEVER an access/authorization token. No column or table policy change is needed.
--     (Same "new column inherits the row policy" posture as Slice 4's order_seq.)
--
--   * THE ONE NEW WRITE PATH — mark_order_confirmation_email_sent() — is NOT an RLS policy and adds
--     none. It is a service-role-only function (EXECUTE granted to service_role, revoked from public /
--     anon / authenticated in migration.sql) that runs as the service role and BYPASSES RLS BY DESIGN
--     — the same shape as Slice 3's order-write RPCs. Slice 3's standing rule "NO insert/update/delete
--     policies for any client role on orders, ever" is therefore UNCHANGED and remains true; no client
--     role can set the marker. Its safety is enforced by the EXECUTE grant + the function body (atomic
--     NULL-guarded claim, invoked only by the server), NOT by a row policy.
--
-- NET: no table is default-open, no new default-open surface is introduced, and no existing write-deny
-- posture is loosened. The security_shield flaw-#2 gate is satisfied vacuously for new tables (there
-- are none) and affirmatively for the orders table this slice reads + service-writes.

-- (Intentionally no executable statements. Re-enabling RLS on the Slice-3 orders table here would be a
-- redundant no-op; its policies are owned by the 20260702 change-set and remain in force.)
