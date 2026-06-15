-- =============================================================================
-- FX Trade Warriors — Supabase schema
-- =============================================================================
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query).
-- Run schema.sql FIRST, then rls_policies.sql.
--
-- Column shapes mirror the existing localStorage objects so the future migration
-- is a straight field-for-field copy. Money is stored as numeric(14,2); only the
-- snake_case naming differs from the current camelCase app objects.
-- =============================================================================

-- Needed for gen_random_uuid().
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- One row per authenticated user. Mirrors the hardcoded user fields in
-- js/auth.js (username, displayName). id references Supabase Auth's user id.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- trading_accounts
-- Mirrors loadAccounts()/normalizeAccount() in js/journal.js.
-- account_type: 'live' | 'prop'    phase: '' | 'phase1' | 'phase2'
-- account_status: '' | 'ACTIVE' | 'PASSED' | 'FAILED'
-- ---------------------------------------------------------------------------
create table if not exists public.trading_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_name           text not null default 'Trading Account',
  account_type           text not null default 'live'
                           check (account_type in ('live', 'prop')),
  phase                  text not null default ''
                           check (phase in ('', 'phase1', 'phase2')),
  initial_balance        numeric(14, 2) not null default 0,
  starting_balance       numeric(14, 2) not null default 0,
  current_balance        numeric(14, 2) not null default 0,
  target_percent         numeric(6, 2),
  target_balance         numeric(14, 2),
  daily_date             text not null default '',
  daily_start_balance    numeric(14, 2),
  daily_drawdown_limit   numeric(14, 2),
  daily_minimum_balance  numeric(14, 2),
  account_status         text not null default ''
                           check (account_status in ('', 'ACTIVE', 'PASSED', 'FAILED')),
  created_at             timestamptz not null default now()
);

create index if not exists trading_accounts_user_id_idx
  on public.trading_accounts (user_id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- Mirrors the journal entry fields produced in js/journal.js and js/sessions.js.
-- account_id cascades so deleting an account removes its entries (matches the
-- current deleteAccount() behaviour).
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id           uuid references public.trading_accounts (id) on delete cascade,
  market               text,
  entry_price          numeric(18, 6),
  stop_loss            numeric(18, 6),
  take_profit          numeric(18, 6),
  exit_price           numeric(18, 6),
  lot_size             numeric(12, 2),
  entry_time           text,
  exit_time            text,
  duration_minutes     integer,
  entry_session_key    text,
  entry_session_label  text,
  exit_session_key     text,
  exit_session_label   text,
  entry_logic          text,
  exit_logic           text,
  final_trade_pnl      numeric(14, 2),
  result               text,
  mistakes             text,
  lessons              text,
  created_at           timestamptz not null default now()
);

create index if not exists journal_entries_user_id_idx
  on public.journal_entries (user_id);
create index if not exists journal_entries_account_id_idx
  on public.journal_entries (account_id);

-- ---------------------------------------------------------------------------
-- calculator_history
-- Mirrors saveTrade() in js/history.js.
-- ---------------------------------------------------------------------------
create table if not exists public.calculator_history (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument          text,
  account_balance     numeric(14, 2),
  risk_type           text,
  risk_value          numeric(14, 4),
  entry_price         numeric(18, 6),
  stop_loss           numeric(18, 6),
  take_profit         numeric(18, 6),
  lot_size            numeric(12, 2),
  risk_amount         numeric(14, 2),
  potential_profit    numeric(14, 2),
  potential_loss      numeric(14, 2),
  risk_reward_ratio   numeric(10, 2),
  created_at          timestamptz not null default now()
);

create index if not exists calculator_history_user_id_idx
  on public.calculator_history (user_id);
