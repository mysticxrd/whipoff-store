-- Migration: Merchant “new order” alert (Resend) — idempotency marker + mark RPC (DDL).
-- Shipped from stages/01_data/output/{migration,rls}.sql. No new tables / no new RLS policies
-- (column inherits orders RLS; mark RPC is service-role EXECUTE lockdown only).
-- Forward-only; runs AFTER 20260712090000_razorpay_swap.sql.

-- NEW #1 — merchant-notify idempotency marker on the existing orders table.
alter table public.orders
  add column if not exists merchant_notify_email_sent_at timestamptz;

comment on column public.orders.merchant_notify_email_sent_at is
  'Merchant new-order alert email idempotency marker (PRD merchant order alert). NULL = not yet sent; timestamp = recorded sent by mark_order_merchant_notify_email_sent() in the webhook path. Written ONLY by the service role; never client-writable. Independent of confirmation_email_sent_at. Not money/status/authz — just send bookkeeping.';

-- Backfill: treat every ALREADY-PAID order as already-notified so ACTIVATING this feature never
-- retroactively emails ops for historical paid rows.
update public.orders
set merchant_notify_email_sent_at = paid_at
where paid_at is not null
  and merchant_notify_email_sent_at is null;

-- NEW #2 — mark_order_merchant_notify_email_sent(): record that the merchant alert was sent.
create or replace function public.mark_order_merchant_notify_email_sent(p_order_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  update public.orders
  set merchant_notify_email_sent_at = now()
  where id = p_order_id
    and merchant_notify_email_sent_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

comment on function public.mark_order_merchant_notify_email_sent(uuid) is
  'Records that a merchant new-order alert email was sent (PRD merchant order alert). Atomic claim (sets orders.merchant_notify_email_sent_at only where NULL); returns TRUE iff this call set it. Service-role only (EXECUTE revoked from client roles) — the webhook''s prefer-delivery send-then-mark step. Never touches money/status/lines. Independent of mark_order_confirmation_email_sent.';

revoke execute on function public.mark_order_merchant_notify_email_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_merchant_notify_email_sent(uuid) to service_role;
