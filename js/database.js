// =============================================================================
// Supabase data-access layer (JSONB model)
// =============================================================================
//
// Each app record (account / journal entry / calculator history) is stored
// verbatim in a `data` jsonb column, with stable top-level columns for identity,
// ownership and ordering. These helpers map between the camelCase app objects
// used everywhere else and the table rows, so journal.js / history.js never touch
// Supabase directly.
//
//  - Reads return the app objects (camelCase), newest first.
//  - Writes are upserts keyed on the client-generated id, so re-saving an
//    account (e.g. after a balance recalculation) updates in place.
//  - user_id is set by the database default (auth.uid()); RLS guarantees a user
//    only ever reads/writes their own rows.
//  - Each helper throws on error.
// =============================================================================

import { getSupabaseClient, TABLES } from "./supabase.js";

function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message || "Supabase request failed.");
  }

  return data;
}

// --- Row <-> app-object mappers --------------------------------------------

function accountToRow(account) {
  return { id: account.id, data: account, created_at: account.createdAt };
}

function rowToAccount(row) {
  // `data` is authoritative; id/userId are reasserted from the columns.
  return { ...row.data, id: row.id, userId: row.user_id };
}

function entryToRow(entry) {
  return {
    id: entry.id,
    account_id: entry.accountId || null,
    data: entry,
    created_at: entry.createdAt,
  };
}

function rowToEntry(row) {
  return { ...row.data, id: row.id, accountId: row.account_id ?? row.data.accountId };
}

function historyToRow(item) {
  // Calculator history uses `date` (ISO) as its timestamp.
  return { id: item.id, data: item, created_at: item.date };
}

function rowToHistory(row) {
  return { ...row.data, id: row.id };
}

// --- Trading accounts -------------------------------------------------------

export async function getAccounts() {
  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.TRADING_ACCOUNTS)
      .select("*")
      .order("created_at", { ascending: false }),
  );
  return rows.map(rowToAccount);
}

// Insert or update a single account (keyed on id).
export async function upsertAccount(account) {
  const supabase = getSupabaseClient();
  const row = unwrap(
    await supabase
      .from(TABLES.TRADING_ACCOUNTS)
      .upsert(accountToRow(account), { onConflict: "id" })
      .select()
      .single(),
  );
  return rowToAccount(row);
}

// Bulk upsert (used by recalculation persistence and migration).
export async function upsertAccounts(accounts) {
  if (!accounts.length) {
    return [];
  }

  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.TRADING_ACCOUNTS)
      .upsert(accounts.map(accountToRow), { onConflict: "id" })
      .select(),
  );
  return rows.map(rowToAccount);
}

export async function deleteAccount(id) {
  const supabase = getSupabaseClient();
  // ON DELETE CASCADE removes the account's journal entries too.
  return unwrap(await supabase.from(TABLES.TRADING_ACCOUNTS).delete().eq("id", id));
}

// Back-compat aliases for the originally specified API.
export const createAccount = upsertAccount;
export const updateAccount = upsertAccount;

// --- Journal entries --------------------------------------------------------

export async function getJournalEntries() {
  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .select("*")
      .order("created_at", { ascending: false }),
  );
  return rows.map(rowToEntry);
}

export async function upsertJournalEntry(entry) {
  const supabase = getSupabaseClient();
  const row = unwrap(
    await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .upsert(entryToRow(entry), { onConflict: "id" })
      .select()
      .single(),
  );
  return rowToEntry(row);
}

export async function upsertJournalEntries(entries) {
  if (!entries.length) {
    return [];
  }

  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.JOURNAL_ENTRIES)
      .upsert(entries.map(entryToRow), { onConflict: "id" })
      .select(),
  );
  return rows.map(rowToEntry);
}

export async function deleteJournalEntry(id) {
  const supabase = getSupabaseClient();
  return unwrap(await supabase.from(TABLES.JOURNAL_ENTRIES).delete().eq("id", id));
}

export const createJournalEntry = upsertJournalEntry;
export const updateJournalEntry = upsertJournalEntry;

// --- Calculator history -----------------------------------------------------

export async function getCalculatorHistory() {
  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.CALCULATOR_HISTORY)
      .select("*")
      .order("created_at", { ascending: false }),
  );
  return rows.map(rowToHistory);
}

export async function createCalculatorHistory(item) {
  const supabase = getSupabaseClient();
  const row = unwrap(
    await supabase
      .from(TABLES.CALCULATOR_HISTORY)
      .upsert(historyToRow(item), { onConflict: "id" })
      .select()
      .single(),
  );
  return rowToHistory(row);
}

export async function createCalculatorHistoryBulk(items) {
  if (!items.length) {
    return [];
  }

  const supabase = getSupabaseClient();
  const rows = unwrap(
    await supabase
      .from(TABLES.CALCULATOR_HISTORY)
      .upsert(items.map(historyToRow), { onConflict: "id" })
      .select(),
  );
  return rows.map(rowToHistory);
}

export async function deleteCalculatorHistory(id) {
  const supabase = getSupabaseClient();
  return unwrap(await supabase.from(TABLES.CALCULATOR_HISTORY).delete().eq("id", id));
}

// Delete every calculator-history row for the current user (RLS scopes it).
export async function clearCalculatorHistory() {
  const supabase = getSupabaseClient();
  return unwrap(
    await supabase.from(TABLES.CALCULATOR_HISTORY).delete().not("id", "is", null),
  );
}
