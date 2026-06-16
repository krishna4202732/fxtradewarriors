// =============================================================================
// One-time localStorage → Supabase migration.
// =============================================================================
//
// On first load after the Supabase migration, any data the current user still
// has in localStorage (accounts / journal / calculator history) is uploaded to
// Supabase, then the localStorage keys are removed. This is idempotent: a flag
// is set on completion and the keys are cleared, so it only ever runs once and
// never re-uploads.
//
// Data is keyed by the user's stable id (the same `fx.user.<id>.*` scheme the
// app already used), so each user only migrates their own data. Theme preference
// is intentionally left in localStorage.
// =============================================================================

import {
  upsertAccounts,
  upsertJournalEntries,
  createCalculatorHistoryBulk,
} from "./database.js";

function legacyKey(userId, collection) {
  return `fx.user.${userId}.${collection}`;
}

function migratedFlagKey(userId) {
  return `fx.user.${userId}.migratedToSupabase`;
}

function readLegacyArray(userId, collection) {
  try {
    const parsed = JSON.parse(localStorage.getItem(legacyKey(userId, collection)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

// Migrates the current user's legacy localStorage data into Supabase exactly
// once. Returns true if a migration actually ran (data was uploaded).
export async function migrateLegacyData(userId) {
  if (!userId || localStorage.getItem(migratedFlagKey(userId)) === "done") {
    return false;
  }

  const accounts = readLegacyArray(userId, "accounts");
  const entries = readLegacyArray(userId, "journal");
  const history = readLegacyArray(userId, "history");

  // Nothing to migrate — mark done so we don't re-check every load.
  if (!accounts.length && !entries.length && !history.length) {
    localStorage.setItem(migratedFlagKey(userId), "done");
    return false;
  }

  // Order matters: accounts before entries (entries reference account ids via a
  // foreign key). Entries whose account is missing are dropped to avoid an FK
  // failure — they would have been orphaned/unreachable in the UI anyway.
  const accountIds = new Set(accounts.map((account) => account.id));
  const linkedEntries = entries.filter(
    (entry) => !entry.accountId || accountIds.has(entry.accountId),
  );

  await upsertAccounts(accounts);
  await upsertJournalEntries(linkedEntries);
  await createCalculatorHistoryBulk(history);

  // Success: drop the legacy keys and record completion.
  localStorage.removeItem(legacyKey(userId, "accounts"));
  localStorage.removeItem(legacyKey(userId, "journal"));
  localStorage.removeItem(legacyKey(userId, "history"));
  localStorage.setItem(migratedFlagKey(userId), "done");

  return true;
}
