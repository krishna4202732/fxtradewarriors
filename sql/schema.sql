-- =============================================================================
-- FX Trade Warriors — Supabase schema (JSONB model)
-- =============================================================================
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query).
-- Run schema.sql FIRST, then rls_policies.sql.
--
-- WHY JSONB: the app's account / journal / calculator objects are rich and still
-- evolving (derived prop-firm fields, session analysis, outcome, notes, R:R, …).
-- All business logic and computation happen client-side — Supabase is pure
-- storage here — so each record is stored verbatim in a `data` jsonb column.
-- This guarantees ZERO field loss when migrating the existing localStorage data
-- and means future fields need no schema change.
--
-- Stable top-level columns are kept for identity, ownership (RLS), relations and
-- ordering: id, user_id, account_id (entries only), created_at.
--
-- IMPORTANT: this DROPs the previous empty tables and recreates them. Safe to run
-- now because no data has been written to Supabase yet (the app still used
-- localStorage). The app auto-migrates localStorage data on first load after this.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Drop old tables (and their policies/indexes) so this script is re-runnable.
drop table if exists public.journal_entries cascade;
drop table if exists public.trading_accounts cascade;
drop table if exists public.calculator_history cascade;

-- ---------------------------------------------------------------------------
-- profiles — one row per authenticated user (unchanged).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- trading_accounts
-- id is the client-generated account id (text, so non-UUID legacy ids migrate
-- cleanly and account_id relations are preserved). data holds the full account
-- object produced by js/journal.js (normalizeAccount + prop-firm dashboard).
-- ---------------------------------------------------------------------------
create table public.trading_accounts (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create index trading_accounts_user_id_idx on public.trading_accounts (user_id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- account_id references the owning account; ON DELETE CASCADE reproduces the
-- app's "deleting an account removes its entries" behaviour.
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  text references public.trading_accounts (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create index journal_entries_user_id_idx on public.journal_entries (user_id);
create index journal_entries_account_id_idx on public.journal_entries (account_id);

-- ---------------------------------------------------------------------------
-- calculator_history — saved lot-size calculations (insert / delete only).
-- ---------------------------------------------------------------------------
create table public.calculator_history (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create index calculator_history_user_id_idx on public.calculator_history (user_id);
