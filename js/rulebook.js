// =============================================================================
// Rule Book — per-account trading discipline rules.
// =============================================================================
//
// Each trading account can optionally enable a rule book. It carries three
// predefined rules that are evaluated AUTOMATICALLY from the account's journal
// entries for the current (IST) day, plus any number of custom rules whose
// pass/fail status the user toggles manually.
//
// The rule book is stored inside the account's JSONB record (see
// updateAccountRuleBook in journal.js), so it is scoped to the account and needs
// no schema change. This module owns its own DOM and is driven by the journal
// page via setupRuleBook() (once) and refreshRuleBook() (after every render).
// =============================================================================

import { loadAccounts, loadJournalEntries, updateAccountRuleBook } from "./journal.js";
import { escapeHtml, getIstDateTimeLocalValue, showToast } from "./dom-utils.js";
import { formatCurrency } from "./calculator.js";

const elements = {};
let ctx = null;
let selectedAccountId = "";
let customRules = [];
// Preserved across saves so the Rule Reports day-rollover marker is never lost
// when the user edits limits/custom rules.
let loadedLastTrackedDate = "";

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActiveUserId() {
  return ctx && typeof ctx.getActiveUserId === "function" ? ctx.getActiveUserId() : "";
}

// --- Data shape -------------------------------------------------------------

function normalizeCustomRule(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const title = String(raw.title || "").trim();

  if (!title) {
    return null;
  }

  return {
    id: raw.id || createId(),
    title,
    description: String(raw.description || "").trim(),
    status: Boolean(raw.status),
  };
}

function normalizeRuleBook(raw) {
  const source = raw && typeof raw === "object" ? raw : {};

  return {
    enabled: Boolean(source.enabled),
    maxDailyRiskCap: numberOrNull(source.maxDailyRiskCap),
    maxRiskPerTrade: numberOrNull(source.maxRiskPerTrade),
    maxTradesPerDay: numberOrNull(source.maxTradesPerDay),
    customRules: Array.isArray(source.customRules)
      ? source.customRules.map(normalizeCustomRule).filter(Boolean)
      : [],
    // Day the rule book is currently tracking; used by the Rule Reports system
    // to archive the previous day and reset on a new day.
    lastTrackedDate: typeof source.lastTrackedDate === "string" ? source.lastTrackedDate : "",
  };
}

function getAccountById(accountId) {
  return loadAccounts(getActiveUserId()).find((account) => account.id === accountId) || null;
}

// --- Rule calculations (from journal data) ----------------------------------

// Date portion of the entry's IST entry time (falls back to createdAt).
function entryDateKey(entry) {
  return String(entry.entryTime || entry.createdAt || "").slice(0, 10);
}

function getTodaysEntries(accountId) {
  const todayKey = getIstDateTimeLocalValue().slice(0, 10);
  return loadJournalEntries(getActiveUserId()).filter(
    (entry) => entry.accountId === accountId && entryDateKey(entry) === todayKey,
  );
}

// Evaluates the three predefined rules against today's trades. `risk` per trade
// is the trade's potential loss (already stored on each entry).
function evaluatePredefinedRules(ruleBook, todaysEntries) {
  const totalRisk = todaysEntries.reduce((sum, entry) => sum + (Number(entry.potentialLoss) || 0), 0);
  const largestRisk = todaysEntries.reduce(
    (max, entry) => Math.max(max, Number(entry.potentialLoss) || 0),
    0,
  );
  const tradeCount = todaysEntries.length;

  return [
    {
      label: "Max Daily Risk Cap",
      configured: Number.isFinite(ruleBook.maxDailyRiskCap),
      detail: Number.isFinite(ruleBook.maxDailyRiskCap)
        ? `Today's total risk ${formatCurrency(totalRisk)} of ${formatCurrency(ruleBook.maxDailyRiskCap)}`
        : "Set a daily risk cap to track this rule.",
      passed: Number.isFinite(ruleBook.maxDailyRiskCap) ? totalRisk <= ruleBook.maxDailyRiskCap : null,
    },
    {
      label: "Max Risk Per Trade",
      configured: Number.isFinite(ruleBook.maxRiskPerTrade),
      detail: Number.isFinite(ruleBook.maxRiskPerTrade)
        ? `Largest trade risk ${formatCurrency(largestRisk)} of ${formatCurrency(ruleBook.maxRiskPerTrade)}`
        : "Set a per-trade risk limit to track this rule.",
      passed: Number.isFinite(ruleBook.maxRiskPerTrade)
        ? tradeCount === 0 || largestRisk <= ruleBook.maxRiskPerTrade
        : null,
    },
    {
      label: "Max Trades Per Day",
      configured: Number.isFinite(ruleBook.maxTradesPerDay),
      detail: Number.isFinite(ruleBook.maxTradesPerDay)
        ? `${tradeCount} of ${ruleBook.maxTradesPerDay} trades today`
        : "Set a max trades per day to track this rule.",
      passed: Number.isFinite(ruleBook.maxTradesPerDay) ? tradeCount <= ruleBook.maxTradesPerDay : null,
    },
  ];
}

// --- Persistence ------------------------------------------------------------

// Builds the rule book from current DOM + module state.
function buildRuleBook() {
  return {
    enabled: elements.ruleBookEnabled.checked,
    maxDailyRiskCap: numberOrNull(elements.ruleMaxDailyRisk.value),
    maxRiskPerTrade: numberOrNull(elements.ruleMaxRiskPerTrade.value),
    maxTradesPerDay: numberOrNull(elements.ruleMaxTradesPerDay.value),
    customRules,
    lastTrackedDate: loadedLastTrackedDate,
  };
}

async function persist() {
  const userId = getActiveUserId();

  if (!userId || !selectedAccountId) {
    return;
  }

  await updateAccountRuleBook(userId, selectedAccountId, buildRuleBook());
}

// --- Rendering --------------------------------------------------------------

function statusBadge(passed) {
  if (passed === true) {
    return '<span class="positive">✓ Pass</span>';
  }

  if (passed === false) {
    return '<span class="negative">✗ Fail</span>';
  }

  return "<span>—</span>";
}

function renderPredefinedStatus() {
  const ruleBook = buildRuleBook();
  const rows = evaluatePredefinedRules(ruleBook, getTodaysEntries(selectedAccountId));

  elements.ruleBookStatus.innerHTML = rows
    .map(
      (row) => `
        <div class="rule-status-item">
          <div>
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.detail)}</span>
          </div>
          ${statusBadge(row.passed)}
        </div>
      `,
    )
    .join("");
}

function renderCustomRules() {
  if (customRules.length === 0) {
    elements.customRuleList.innerHTML = '<p class="empty-state">No custom rules yet.</p>';
    return;
  }

  elements.customRuleList.innerHTML = customRules
    .map(
      (rule) => `
        <div class="rule-item" data-rule-id="${escapeHtml(rule.id)}">
          <div>
            <strong>${escapeHtml(rule.title)}</strong>
            ${rule.description ? `<p>${escapeHtml(rule.description)}</p>` : ""}
          </div>
          <div class="rule-item-actions">
            <button class="button secondary" type="button" data-rule-action="toggle" data-id="${escapeHtml(rule.id)}">
              ${rule.status ? '<span class="positive">✓ Followed</span>' : '<span class="negative">✗ Broken</span>'}
            </button>
            <button class="button danger" type="button" data-rule-action="delete" data-id="${escapeHtml(rule.id)}">Remove</button>
          </div>
        </div>
      `,
    )
    .join("");
}

// Reflects the enabled toggle: when off, the rule logic is hidden entirely.
function applyEnabledState() {
  elements.ruleBookContent.classList.toggle("is-hidden", !elements.ruleBookEnabled.checked);
}

// Loads a specific account's saved rule book into the form + state.
function loadAccount(accountId) {
  selectedAccountId = accountId;

  const account = getAccountById(accountId);
  const ruleBook = normalizeRuleBook(account ? account.ruleBook : null);

  elements.ruleBookEnabled.checked = ruleBook.enabled;
  elements.ruleMaxDailyRisk.value = ruleBook.maxDailyRiskCap ?? "";
  elements.ruleMaxRiskPerTrade.value = ruleBook.maxRiskPerTrade ?? "";
  elements.ruleMaxTradesPerDay.value = ruleBook.maxTradesPerDay ?? "";
  customRules = ruleBook.customRules;
  loadedLastTrackedDate = ruleBook.lastTrackedDate;

  applyEnabledState();
  renderPredefinedStatus();
  renderCustomRules();
}

function populateAccountOptions(accounts) {
  const previous = elements.ruleBookAccount.value;
  elements.ruleBookAccount.innerHTML = accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");

  const stillExists = accounts.some((account) => account.id === previous);
  elements.ruleBookAccount.value = stillExists ? previous : accounts[0].id;
}

// --- Public API -------------------------------------------------------------

// Re-render for the current account. Called after every journal render so the
// predefined rule results stay live as trades are added/removed. Inputs are only
// reloaded when the selected account actually changes (so unsaved edits survive).
export function refreshRuleBook() {
  if (!ctx) {
    return;
  }

  const accounts = loadAccounts(getActiveUserId());

  if (accounts.length === 0) {
    elements.ruleBookEmpty.classList.remove("is-hidden");
    elements.ruleBookBody.classList.add("is-hidden");
    selectedAccountId = "";
    return;
  }

  elements.ruleBookEmpty.classList.add("is-hidden");
  elements.ruleBookBody.classList.remove("is-hidden");
  populateAccountOptions(accounts);

  if (elements.ruleBookAccount.value !== selectedAccountId) {
    loadAccount(elements.ruleBookAccount.value);
  } else {
    renderPredefinedStatus();
  }
}

async function handleAddCustomRule(event) {
  event.preventDefault();

  const title = elements.customRuleTitle.value.trim();

  if (!title || !selectedAccountId) {
    return;
  }

  customRules = [
    ...customRules,
    { id: createId(), title, description: elements.customRuleDescription.value.trim(), status: false },
  ];
  elements.customRuleForm.reset();
  renderCustomRules();
  await persist();
  showToast("Custom rule added.");
}

async function handleCustomRuleAction(event) {
  const button = event.target.closest("button[data-rule-action]");

  if (!button) {
    return;
  }

  const ruleId = button.dataset.id;

  if (button.dataset.ruleAction === "toggle") {
    customRules = customRules.map((rule) =>
      rule.id === ruleId ? { ...rule, status: !rule.status } : rule,
    );
  } else if (button.dataset.ruleAction === "delete") {
    customRules = customRules.filter((rule) => rule.id !== ruleId);
  } else {
    return;
  }

  renderCustomRules();
  await persist();
}

async function handleEnabledToggle() {
  applyEnabledState();
  renderPredefinedStatus();
  await persist();
}

async function handleSave() {
  await persist();
  showToast("Rule book saved.");
}

// Wires up the rule book once, during journal page init. `context` provides
// getActiveUserId(). No-op if the rule book markup is absent on the page.
export function setupRuleBook(context) {
  const ids = [
    "ruleBookEnabled",
    "ruleBookEmpty",
    "ruleBookBody",
    "ruleBookAccount",
    "ruleBookContent",
    "ruleMaxDailyRisk",
    "ruleMaxRiskPerTrade",
    "ruleMaxTradesPerDay",
    "ruleBookStatus",
    "customRuleForm",
    "customRuleTitle",
    "customRuleDescription",
    "customRuleList",
    "saveRuleBook",
  ];

  ids.forEach((id) => {
    elements[id] = document.querySelector(`#${id}`);
  });

  if (!elements.ruleBookEnabled) {
    return;
  }

  ctx = context;

  elements.ruleBookAccount.addEventListener("change", () => loadAccount(elements.ruleBookAccount.value));
  elements.ruleBookEnabled.addEventListener("change", handleEnabledToggle);
  [elements.ruleMaxDailyRisk, elements.ruleMaxRiskPerTrade, elements.ruleMaxTradesPerDay].forEach((input) =>
    input.addEventListener("input", renderPredefinedStatus),
  );
  elements.customRuleForm.addEventListener("submit", handleAddCustomRule);
  elements.customRuleList.addEventListener("click", handleCustomRuleAction);
  elements.saveRuleBook.addEventListener("click", handleSave);
}

// --- Shared evaluation (reused by the Rule Reports system) ------------------

// Evaluates an account's rules for a given day (defaults to today, IST). Pure
// read of journal data — no UI. Returns the normalized rule book, the three
// predefined rule results, and the custom rules.
export function evaluateAccountRules(userId, accountId, dateKey) {
  const day = dateKey || getIstDateTimeLocalValue().slice(0, 10);
  const account = loadAccounts(userId).find((item) => item.id === accountId) || null;
  const ruleBook = normalizeRuleBook(account ? account.ruleBook : null);
  const dayEntries = loadJournalEntries(userId).filter(
    (entry) => entry.accountId === accountId && entryDateKey(entry) === day,
  );

  return {
    ruleBook,
    accountName: account ? account.name : "",
    reportDate: day,
    predefined: evaluatePredefinedRules(ruleBook, dayEntries),
    customRules: ruleBook.customRules,
  };
}

// Overall score = passed rules / total rules. Only configured predefined rules
// (those with a value set) count toward the total; every custom rule counts.
export function scoreRuleResults(predefined, customRules) {
  const activePredefined = predefined.filter((rule) => rule.passed !== null);
  const list = Array.isArray(customRules) ? customRules : [];
  const totalRules = activePredefined.length + list.length;
  const passedRules =
    activePredefined.filter((rule) => rule.passed === true).length +
    list.filter((rule) => rule.status === true).length;

  return {
    passedRules,
    totalRules,
    overallScorePercent: totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : null,
  };
}
