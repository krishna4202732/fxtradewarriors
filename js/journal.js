import {
  describeSessionForDateTimeLocal,
  tradeDurationMinutes,
} from "./sessions.js";
import * as db from "./database.js";
import { migrateLegacyData } from "./migrate.js";

const COLLECTIONS = {
  ACCOUNTS: "accounts",
  JOURNAL: "journal",
};

const ACCOUNT_TYPES = {
  LIVE: "live",
  PROP: "prop",
};

const PROP_PHASES = {
  PHASE_1: "phase1",
  PHASE_2: "phase2",
};

const PROP_FIRM_RULES = {
  dailyDrawdownPercent: 5,
  overallDrawdownPercent: 10,
};

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// In-memory cache, hydrated from Supabase once per page load by initUserData().
// All business logic below operates on this cache synchronously, so rendering
// (and recalculateUserJournal) stays synchronous; Supabase persistence is handled
// by the async mutation functions and initUserData. Keyed by `${userId}:${name}`.
const cache = new Map();

function cacheKey(userId, collection) {
  return `${userId}:${collection}`;
}

function readCollection(userId, collection) {
  if (!userId) {
    return [];
  }

  const records = cache.get(cacheKey(userId, collection));
  return Array.isArray(records) ? records : [];
}

function writeCollection(userId, collection, records) {
  if (!userId) {
    return [];
  }

  const normalizedRecords = Array.isArray(records) ? records : [];
  cache.set(cacheKey(userId, collection), normalizedRecords);
  return normalizedRecords;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}

function roundPercent(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 10) / 10;
}

function getLocalDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

// Derives session + duration fields from the stored entry/exit timestamps so that
// older entries (saved before exit-time existed) are backfilled on every recalc.
function withSessionAnalysis(entry) {
  const entrySession = describeSessionForDateTimeLocal(entry.entryTime);
  const exitSession = describeSessionForDateTimeLocal(entry.exitTime);
  const durationMinutes = tradeDurationMinutes(entry.entryTime, entry.exitTime);

  return {
    ...entry,
    entrySessionKey: entrySession ? entrySession.key : "",
    entrySessionLabel: entrySession ? entrySession.label : "",
    exitSessionKey: exitSession ? exitSession.key : "",
    exitSessionLabel: exitSession ? exitSession.label : "",
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
  };
}

function sortEntriesNewestFirst(entries) {
  return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortEntriesOldestFirst(entries) {
  return [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function normalizeAccountType(value) {
  return value === ACCOUNT_TYPES.PROP ? ACCOUNT_TYPES.PROP : ACCOUNT_TYPES.LIVE;
}

function normalizePhase(value) {
  return value === PROP_PHASES.PHASE_2 ? PROP_PHASES.PHASE_2 : PROP_PHASES.PHASE_1;
}

function getTargetPercent(accountType, phase) {
  if (accountType !== ACCOUNT_TYPES.PROP) {
    return null;
  }

  return phase === PROP_PHASES.PHASE_2 ? 5 : 8;
}

function normalizeAccount(account) {
  const accountType = normalizeAccountType(account.accountType);
  const phase = accountType === ACCOUNT_TYPES.PROP ? normalizePhase(account.phase) : "";
  const initialBalance = roundMoney(
    Number.isFinite(Number(account.initialBalance))
      ? account.initialBalance
      : Number.isFinite(Number(account.startingBalance))
        ? account.startingBalance
        : account.currentBalance,
  );
  const startingBalance = roundMoney(
    Number.isFinite(Number(account.startingBalance))
      ? account.startingBalance
      : Number.isFinite(Number(account.currentBalance))
        ? account.currentBalance
        : initialBalance,
  );
  const currentBalance = roundMoney(
    Number.isFinite(Number(account.currentBalance))
      ? account.currentBalance
      : startingBalance,
  );
  const targetPercent = getTargetPercent(accountType, phase);
  const targetBalance =
    targetPercent === null
      ? null
      : roundMoney(initialBalance * (1 + targetPercent / 100));
  const accountName = String(account.accountName || account.name || "Trading Account").trim();

  return {
    ...account,
    id: account.id,
    userId: account.userId,
    accountName,
    name: accountName,
    accountType,
    phase,
    initialBalance,
    startingBalance,
    currentBalance,
    targetPercent,
    targetBalance,
    dailyDate: account.dailyDate || "",
    dailyStartBalance: Number.isFinite(Number(account.dailyStartBalance))
      ? roundMoney(account.dailyStartBalance)
      : null,
    dailyDrawdownLimit: Number.isFinite(Number(account.dailyDrawdownLimit))
      ? roundMoney(account.dailyDrawdownLimit)
      : null,
    dailyMinimumBalance: Number.isFinite(Number(account.dailyMinimumBalance))
      ? roundMoney(account.dailyMinimumBalance)
      : null,
    createdAt: account.createdAt || new Date().toISOString(),
  };
}

function applyPropFirmDashboard(account, dateKey = getLocalDateKey()) {
  if (account.accountType !== ACCOUNT_TYPES.PROP) {
    return {
      ...account,
      dailyDate: "",
      dailyStartBalance: null,
      dailyDrawdownLimit: null,
      dailyMinimumBalance: null,
      propFirm: null,
      accountStatus: "",
    };
  }

  const currentBalance = roundMoney(account.currentBalance);
  const initialBalance = roundMoney(account.initialBalance);
  const targetBalance = roundMoney(account.targetBalance);
  const targetDistance = Math.max(targetBalance - initialBalance, 0);
  const hasCurrentSnapshot =
    account.dailyDate === dateKey &&
    Number.isFinite(Number(account.dailyStartBalance));
  const dailyStartBalance = hasCurrentSnapshot
    ? roundMoney(account.dailyStartBalance)
    : currentBalance;
  const dailyDrawdownLimit = roundMoney(dailyStartBalance * (PROP_FIRM_RULES.dailyDrawdownPercent / 100));
  const dailyMinimumBalance = roundMoney(dailyStartBalance - dailyDrawdownLimit);
  const overallDrawdownLimit = roundMoney(initialBalance * (PROP_FIRM_RULES.overallDrawdownPercent / 100));
  const minimumAllowedBalance = roundMoney(initialBalance - overallDrawdownLimit);
  const dailyDrawdownUsed = roundMoney(Math.max(dailyStartBalance - currentBalance, 0));
  const dailyDrawdownRemaining = roundMoney(Math.max(dailyDrawdownLimit - dailyDrawdownUsed, 0));
  const overallDrawdownUsed = roundMoney(Math.max(initialBalance - currentBalance, 0));
  const overallDrawdownRemaining = roundMoney(Math.max(overallDrawdownLimit - overallDrawdownUsed, 0));
  const targetProgressPercent =
    targetDistance > 0
      ? roundPercent(((currentBalance - initialBalance) / targetDistance) * 100)
      : 0;
  const dailyUsagePercent =
    dailyDrawdownLimit > 0
      ? roundPercent((dailyDrawdownUsed / dailyDrawdownLimit) * 100)
      : 0;
  const overallUsagePercent =
    overallDrawdownLimit > 0
      ? roundPercent((overallDrawdownUsed / overallDrawdownLimit) * 100)
      : 0;
  const remainingTarget = roundMoney(Math.max(targetBalance - currentBalance, 0));
  let accountStatus = "ACTIVE";

  if (currentBalance >= targetBalance) {
    accountStatus = "PASSED";
  } else if (currentBalance <= minimumAllowedBalance || currentBalance <= dailyMinimumBalance) {
    accountStatus = "FAILED";
  }

  return {
    ...account,
    currentBalance,
    dailyDate: dateKey,
    dailyStartBalance,
    dailyDrawdownLimit,
    dailyMinimumBalance,
    accountStatus,
    propFirm: {
      targetProgressPercent,
      remainingTarget,
      dailyDrawdownUsed,
      dailyDrawdownRemaining,
      dailyUsagePercent,
      overallDrawdownLimit,
      minimumAllowedBalance,
      overallDrawdownUsed,
      overallDrawdownRemaining,
      overallUsagePercent,
      dailyDate: dateKey,
      dailyStartBalance,
      dailyDrawdownLimit,
      dailyMinimumBalance,
      status: accountStatus,
    },
  };
}

export function loadAccounts(userId) {
  return readCollection(userId, COLLECTIONS.ACCOUNTS).map(normalizeAccount);
}

export function loadJournalEntries(userId) {
  return sortEntriesNewestFirst(readCollection(userId, COLLECTIONS.JOURNAL));
}

// Hydrate the in-memory cache from Supabase for this page load. Runs the
// one-time localStorage → Supabase migration first, then recomputes derived
// fields and persists the (re)computed account balances so the stored daily
// snapshot stays current — mirroring the old "recalc on render" persistence.
export async function initUserData(userId) {
  if (!userId) {
    return { accounts: [], entries: [] };
  }

  await migrateLegacyData(userId);

  const [accounts, entries] = await Promise.all([
    db.getAccounts(),
    db.getJournalEntries(),
  ]);

  writeCollection(userId, COLLECTIONS.ACCOUNTS, accounts);
  writeCollection(userId, COLLECTIONS.JOURNAL, entries);

  const result = recalculateUserJournal(userId);
  await db.upsertAccounts(result.accounts);
  return result;
}

export async function createAccount(userId, accountInput) {
  const accountType = normalizeAccountType(accountInput.accountType);
  const initialBalance = roundMoney(accountInput.initialBalance);
  const currentBalance = roundMoney(accountInput.currentBalance);
  const account = normalizeAccount({
    id: createId(),
    userId,
    accountName: String(accountInput.name || "").trim(),
    accountType,
    phase: accountType === ACCOUNT_TYPES.PROP ? accountInput.phase : "",
    initialBalance,
    startingBalance: currentBalance,
    currentBalance,
    createdAt: new Date().toISOString(),
  });
  const accounts = [account, ...loadAccounts(userId)];

  writeCollection(userId, COLLECTIONS.ACCOUNTS, accounts);
  await db.upsertAccount(account);
  return account;
}

export async function addJournalEntry(userId, entryInput) {
  const entry = {
    id: createId(),
    userId,
    ...entryInput,
    createdAt: new Date().toISOString(),
  };
  const entries = [entry, ...loadJournalEntries(userId)];

  writeCollection(userId, COLLECTIONS.JOURNAL, entries);
  const result = recalculateUserJournal(userId);
  await db.upsertJournalEntry(entry);
  await db.upsertAccounts(result.accounts);
  return result;
}

export async function deleteJournalEntry(userId, entryId) {
  const entries = loadJournalEntries(userId).filter((entry) => entry.id !== entryId);

  writeCollection(userId, COLLECTIONS.JOURNAL, entries);
  const result = recalculateUserJournal(userId);
  await db.deleteJournalEntry(entryId);
  await db.upsertAccounts(result.accounts);
  return result;
}

export async function deleteAccount(userId, accountId) {
  const accounts = loadAccounts(userId).filter((account) => account.id !== accountId);
  const entries = loadJournalEntries(userId).filter((entry) => entry.accountId !== accountId);

  writeCollection(userId, COLLECTIONS.ACCOUNTS, accounts);
  writeCollection(userId, COLLECTIONS.JOURNAL, entries);
  const result = recalculateUserJournal(userId);
  // ON DELETE CASCADE removes the linked journal entries in Supabase too.
  await db.deleteAccount(accountId);
  await db.upsertAccounts(result.accounts);
  return result;
}

export function recalculateUserJournal(userId) {
  const accounts = loadAccounts(userId).map(normalizeAccount);
  const accountsById = new Map(
    accounts.map((account) => [
      account.id,
      {
        ...account,
        currentBalance: roundMoney(account.startingBalance),
      },
    ]),
  );
  const recalculatedEntries = sortEntriesOldestFirst(loadJournalEntries(userId)).map((entry) => {
    const account = accountsById.get(entry.accountId);
    const analyzedEntry = withSessionAnalysis(entry);

    if (!account) {
      return analyzedEntry;
    }

    const accountBalanceBefore = roundMoney(account.currentBalance);
    const accountBalanceAfter = roundMoney(accountBalanceBefore + numberOrZero(entry.finalTradePnL));
    account.currentBalance = accountBalanceAfter;

    return {
      ...analyzedEntry,
      accountName: account.name,
      accountBalanceBefore,
      accountBalanceAfter,
    };
  });

  const currentDateKey = getLocalDateKey();
  const recalculatedAccounts = accounts.map((account) =>
    applyPropFirmDashboard(accountsById.get(account.id) || account, currentDateKey),
  );
  const sortedEntries = sortEntriesNewestFirst(recalculatedEntries);

  writeCollection(userId, COLLECTIONS.ACCOUNTS, recalculatedAccounts);
  writeCollection(userId, COLLECTIONS.JOURNAL, sortedEntries);

  return {
    accounts: recalculatedAccounts,
    entries: sortedEntries,
  };
}
