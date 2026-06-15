// =============================================================================
// Supabase data-access helpers
// =============================================================================
//
// Thin wrappers around the Supabase client for the four app tables. These are
// PREPARED for the future migration — nothing in the current app calls them yet,
// and localStorage remains the live data source. Once auth is wired up, the
// existing modules (journal.js, history.js, etc.) can switch to these.
//
// Conventions:
//  - Each helper throws on error so callers can use try/catch, mirroring how the
//    rest of the codebase signals failure.
//  - `user_id` is intentionally NOT passed in by callers. Supabase sets it from
//    the authenticated session (see DEFAULT auth.uid() in sql/schema.sql) and RLS
//    guarantees a user only ever sees their own rows. When auth lands, inserts
//    just work; until then these helpers throw a clear "not configured" error.
//  - DB columns use snake_case (Postgres convention); the app objects use
//    camelCase. Mapping is left to the migration step to keep this layer thin.
// =============================================================================

import { getSupabaseClient, TABLES } from "./supabase.js";

/**
 * Unwraps a Supabase response, throwing on error and returning the data.
 * @param {{ data: any, error: any }} response
 */
function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message || "Supabase request failed.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Trading accounts
// ---------------------------------------------------------------------------

/**
 * Insert a new trading account. `account` should use snake_case columns
 * (e.g. account_name, account_type, phase, initial_balance, ...). user_id is
 * filled in by Supabase from the session.
 */
export async function createAccount(account) {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase.from(TABLES.TRADING_ACCOUNTS).insert(account).select().single(),
  );
}

/**
 * Update an existing trading account by id with a partial set of columns.
 */
export async function updateAccount(id, updates) {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase
      .from(TABLES.TRADING_ACCOUNTS)
      .update(updates)
      .eq("id", id)
      .select()
      .single(),
  );
}

/**
 * Delete a trading account by id. Associated journal_entries are removed by the
 * ON DELETE CASCADE foreign key defined in the schema.
 */
export async function deleteAccount(id) {
  const supabase = getSupabaseClient();
  return unwrap(await supabase.from(TABLES.TRADING_ACCOUNTS).delete().eq("id", id));
}

/**
 * Fetch all trading accounts for the current user (RLS scopes them), newest first.
 */
export async function getAccounts() {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase
      .from(TABLES.TRADING_ACCOUNTS)
      .select("*")
      .order("created_at", { ascending: false }),
  );
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

/**
 * Insert a new journal entry. `entry` should use snake_case columns and include
 * account_id. user_id is filled in by Supabase from the session.
 */
export async function createJournalEntry(entry) {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase.from(TABLES.JOURNAL_ENTRIES).insert(entry).select().single(),
  );
}

/**
 * Update an existing journal entry by id with a partial set of columns.
 */
export async function updateJournalEntry(id, updates) {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .update(updates)
      .eq("id", id)
      .select()
      .single(),
  );
}

/**
 * Delete a journal entry by id.
 */
export async function deleteJournalEntry(id) {
  const supabase = getSupabaseClient();
  return unwrap(await supabase.from(TABLES.JOURNAL_ENTRIES).delete().eq("id", id));
}

/**
 * Fetch journal entries for the current user (RLS scopes them), newest first.
 * Pass an accountId to fetch only entries for a single account.
 */
export async function getJournalEntries(accountId = null) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(TABLES.JOURNAL_ENTRIES)
    .select("*")
    .order("created_at", { ascending: false });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  return unwrap(await query);
}

// ---------------------------------------------------------------------------
// Calculator history
// ---------------------------------------------------------------------------

/**
 * Insert a new calculator history record. `entry` should use snake_case columns.
 * user_id is filled in by Supabase from the session.
 */
export async function createCalculatorHistory(entry) {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase.from(TABLES.CALCULATOR_HISTORY).insert(entry).select().single(),
  );
}

/**
 * Fetch calculator history for the current user (RLS scopes it), newest first.
 */
export async function getCalculatorHistory() {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase
      .from(TABLES.CALCULATOR_HISTORY)
      .select("*")
      .order("created_at", { ascending: false }),
  );
}
