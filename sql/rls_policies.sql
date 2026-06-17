-- =============================================================================
-- FX Trade Warriors — Row Level Security policies
-- =============================================================================
-- Run this AFTER schema.sql in the Supabase SQL editor.
--
-- Every table is locked down so an authenticated user can only ever read or
-- write their own rows. `auth.uid()` is the id of the logged-in user.

--   - profiles            → matched on  id        = auth.uid()
--   - all other tables    → matched on  user_id   = auth.uid()
-- With these policies enabled the public anon key is safe to ship in the
-- frontend: it can do nothing without a valid user session.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- trading_accounts
-- ---------------------------------------------------------------------------
alter table public.trading_accounts enable row level security;

drop policy if exists "trading_accounts_select_own" on public.trading_accounts;
create policy "trading_accounts_select_own"
  on public.trading_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "trading_accounts_insert_own" on public.trading_accounts;
create policy "trading_accounts_insert_own"
  on public.trading_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "trading_accounts_update_own" on public.trading_accounts;
create policy "trading_accounts_update_own"
  on public.trading_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trading_accounts_delete_own" on public.trading_accounts;
create policy "trading_accounts_delete_own"
  on public.trading_accounts for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
alter table public.journal_entries enable row level security;

drop policy if exists "journal_entries_select_own" on public.journal_entries;
create policy "journal_entries_select_own"
  on public.journal_entries for select
  using (auth.uid() = user_id);

drop policy if exists "journal_entries_insert_own" on public.journal_entries;
create policy "journal_entries_insert_own"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "journal_entries_update_own" on public.journal_entries;
create policy "journal_entries_update_own"
  on public.journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journal_entries_delete_own" on public.journal_entries;
create policy "journal_entries_delete_own"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- calculator_history
-- ---------------------------------------------------------------------------
alter table public.calculator_history enable row level security;

drop policy if exists "calculator_history_select_own" on public.calculator_history;
create policy "calculator_history_select_own"
  on public.calculator_history for select
  using (auth.uid() = user_id);

drop policy if exists "calculator_history_insert_own" on public.calculator_history;
create policy "calculator_history_insert_own"
  on public.calculator_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "calculator_history_delete_own" on public.calculator_history;
create policy "calculator_history_delete_own"
  on public.calculator_history for delete
  using (auth.uid() = user_id);
