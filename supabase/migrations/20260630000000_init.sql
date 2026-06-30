-- Migration: Slice 0 walking skeleton — identity foundation (DDL + RLS).
-- Applied form of stages/01_data/output/{migration.sql,rls.sql}.
-- Apply (preview/branch first) at cloud-wiring time: `supabase db push`.
-- Conventions: _config/data_conventions.md. Security: _config/security_shield.md (flaw #2).

-- ============================ DDL ============================

create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Identity/account record per auth user (Slice 0 walking skeleton).';

-- updated_at maintained by trigger (no app-side writes). search_path locked for safety.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile when an auth user is created (SECURITY DEFINER; locked path).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================ RLS ============================
-- RLS enabled, DEFAULT-DENY, own-row only. No policy for an operation = denied.

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using ( (select auth.uid()) = id );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  with check ( (select auth.uid()) = id );

-- DELETE: intentionally NO policy → all row-level deletes denied.
-- Profile removal happens only via cascade from auth.users.
