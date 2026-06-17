-- =============================================================================
-- FX Trade Warriors — daily_rule_reports table
-- =============================================================================
-- Run this STANDALONE in the Supabase SQL editor. It is NON-DESTRUCTIVE:
-- `create table if not exists` only, so it never drops or touches the existing
-- accounts / journal / history tables and their data.
--
-- One report per account per day. The primary key is `<account_id>:<report_date>`
-- so re-saving the same day UPDATES the row instead of creating a duplicate.
-- The full report object lives in `data` (jsonb), matching the app's storage
-- model; stable columns support ownership (RLS), relations and ordering.
-- =============================================================================

create table if not exists public.daily_rule_reports (
  id           text primary key,                       -- `<account_id>:<report_date>`
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   text references public.trading_accounts (id) on delete cascade,
  report_date  text not null,                          -- YYYY-MM-DD
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists daily_rule_reports_user_id_idx
  on public.daily_rule_reports (user_id);
create index if not exists daily_rule_reports_account_id_idx
  on public.daily_rule_reports (account_id);

-- --- Row Level Security: each user sees only their own reports ---------------
alter table public.daily_rule_reports enable row level security;

drop policy if exists "daily_rule_reports_select_own" on public.daily_rule_reports;
create policy "daily_rule_reports_select_own"
  on public.daily_rule_reports for select
  using (auth.uid() = user_id);

drop policy if exists "daily_rule_reports_insert_own" on public.daily_rule_reports;
create policy "daily_rule_reports_insert_own"
  on public.daily_rule_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_rule_reports_update_own" on public.daily_rule_reports;
create policy "daily_rule_reports_update_own"
  on public.daily_rule_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_rule_reports_delete_own" on public.daily_rule_reports;
create policy "daily_rule_reports_delete_own"
  on public.daily_rule_reports for delete
  using (auth.uid() = user_id);
