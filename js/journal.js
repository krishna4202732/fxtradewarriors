const COLLECTIONS = {
  ACCOUNTS: "accounts",
  JOURNAL: "journal",
};

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getUserStorageKey(userId, collection) {
  return `fx.user.${userId}.${collection}`;
}

function readCollection(userId, collection) {
  if (!userId) {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(getUserStorageKey(userId, collection)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeCollection(userId, collection, records) {
  if (!userId) {
    return [];
  }

  const normalizedRecords = Array.isArray(records) ? records : [];
  localStorage.setItem(getUserStorageKey(userId, collection), JSON.stringify(normalizedRecords));
  return normalizedRecords;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}

function sortEntriesNewestFirst(entries) {
  return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortEntriesOldestFirst(entries) {
  return [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function loadAccounts(userId) {
  return readCollection(userId, COLLECTIONS.ACCOUNTS);
}

export function loadJournalEntries(userId) {
  return sortEntriesNewestFirst(readCollection(userId, COLLECTIONS.JOURNAL));
}

export function createAccount(userId, accountInput) {
  const startingBalance = roundMoney(accountInput.balance);
  const account = {
    id: createId(),
    userId,
    name: String(accountInput.name || "").trim(),
    startingBalance,
    currentBalance: startingBalance,
    createdAt: new Date().toISOString(),
  };
  const accounts = [account, ...loadAccounts(userId)];

  writeCollection(userId, COLLECTIONS.ACCOUNTS, accounts);
  return account;
}

export function addJournalEntry(userId, entryInput) {
  const entry = {
    id: createId(),
    userId,
    ...entryInput,
    createdAt: new Date().toISOString(),
  };
  const entries = [entry, ...loadJournalEntries(userId)];

  writeCollection(userId, COLLECTIONS.JOURNAL, entries);
  return recalculateUserJournal(userId);
}

export function deleteJournalEntry(userId, entryId) {
  const entries = loadJournalEntries(userId).filter((entry) => entry.id !== entryId);

  writeCollection(userId, COLLECTIONS.JOURNAL, entries);
  return recalculateUserJournal(userId);
}

export function recalculateUserJournal(userId) {
  const accounts = loadAccounts(userId).map((account) => ({
    ...account,
    startingBalance: roundMoney(
      Number.isFinite(Number(account.startingBalance))
        ? account.startingBalance
        : account.currentBalance,
    ),
  }));
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

    if (!account) {
      return entry;
    }

    const accountBalanceBefore = roundMoney(account.currentBalance);
    const accountBalanceAfter = roundMoney(accountBalanceBefore + numberOrZero(entry.finalTradePnL));
    account.currentBalance = accountBalanceAfter;

    return {
      ...entry,
      accountName: account.name,
      accountBalanceBefore,
      accountBalanceAfter,
    };
  });

  const recalculatedAccounts = accounts.map((account) => accountsById.get(account.id) || account);
  const sortedEntries = sortEntriesNewestFirst(recalculatedEntries);

  writeCollection(userId, COLLECTIONS.ACCOUNTS, recalculatedAccounts);
  writeCollection(userId, COLLECTIONS.JOURNAL, sortedEntries);

  return {
    accounts: recalculatedAccounts,
    entries: sortedEntries,
  };
}
