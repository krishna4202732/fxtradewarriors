// Journal page controller. Carries account management, journal entry creation,
// statistics, live session detection, export, and the trade detail view from
// the original SPA app.js — unchanged behaviour, now scoped to its own page.
// Private page.

import { DEFAULT_STATE, INSTRUMENTS } from "../config.js";
import {
  calculateExitPnl,
  calculateFixedLotTrade,
  formatCurrency,
  formatLot,
  formatPercent,
  formatPrice,
  formatRatio,
} from "../calculator.js";
import {
  addJournalEntry,
  createAccount,
  deleteAccount,
  deleteJournalEntry,
  initUserData,
  loadAccounts,
  loadJournalEntries,
  recalculateUserJournal,
} from "../journal.js";
import {
  describeCurrentSession,
  describeSessionForDateTimeLocal,
  formatDuration,
  formatIstClock,
  tradeDurationMinutes,
} from "../sessions.js";
import { exportJournalCsv, exportJournalPdf } from "../export.js";
import { getDailyRuleReportsInRange } from "../database.js";
import { initTheme } from "../theme.js";
import {
  escapeHtml,
  formatDateTime,
  formatSignedCurrency,
  formatTimeOnly,
  getIstDateTimeLocalValue,
  parseNumber,
  roundMoney,
  setSignedClass,
  setText,
  setupScrollReveal,
  showToast,
} from "../dom-utils.js";
import { requireAuth, initLogout } from "../router.js";
import { mountSharedComponents } from "../components.js";
import { setupRuleBook, refreshRuleBook } from "../rulebook.js";
import { setupRuleReports, refreshRuleReports } from "../ruleReports.js";
import { setupTabs } from "../tabs.js";

const OUTCOME_LABELS = {
  tp: "TP Hit",
  sl: "SL Hit",
  manual: "Exited Before TP/SL",
};

const ACCOUNT_TYPE_LABELS = {
  live: "Live Account",
  prop: "Prop Firm Account",
};

const PHASE_LABELS = {
  phase1: "Phase 1",
  phase2: "Phase 2",
};

const ACCOUNT_STATUS_LABELS = {
  ACTIVE: "Active",
  PASSED: "Passed",
  FAILED: "Failed",
};

const elements = {
  journalMarket: document.querySelector("#journalMarket"),
  accountForm: document.querySelector("#accountForm"),
  accountName: document.querySelector("#accountName"),
  accountType: document.querySelector("#accountType"),
  accountPhaseField: document.querySelector("#accountPhaseField"),
  accountPhase: document.querySelector("#accountPhase"),
  accountInitialBalance: document.querySelector("#accountInitialBalance"),
  accountCurrentBalance: document.querySelector("#accountCurrentBalance"),
  accountErrorPanel: document.querySelector("#accountErrorPanel"),
  accountErrorList: document.querySelector("#accountErrorList"),
  accountsList: document.querySelector("#accountsList"),
  journalAccountEmpty: document.querySelector("#journalAccountEmpty"),
  journalForm: document.querySelector("#journalForm"),
  journalAccount: document.querySelector("#journalAccount"),
  journalEntryPrice: document.querySelector("#journalEntryPrice"),
  journalStopLoss: document.querySelector("#journalStopLoss"),
  journalTakeProfit: document.querySelector("#journalTakeProfit"),
  journalLotSize: document.querySelector("#journalLotSize"),
  journalCommissionPerLot: document.querySelector("#journalCommissionPerLot"),
  journalSwapPaid: document.querySelector("#journalSwapPaid"),
  journalEntryTime: document.querySelector("#journalEntryTime"),
  journalExitTime: document.querySelector("#journalExitTime"),
  journalOutcome: document.querySelector("#journalOutcome"),
  journalExitPriceField: document.querySelector("#journalExitPriceField"),
  journalExitPrice: document.querySelector("#journalExitPrice"),
  journalPotentialProfit: document.querySelector("#journalPotentialProfit"),
  journalPotentialLoss: document.querySelector("#journalPotentialLoss"),
  journalRiskReward: document.querySelector("#journalRiskReward"),
  journalFinalPnl: document.querySelector("#journalFinalPnl"),
  journalCommission: document.querySelector("#journalCommission"),
  journalSwap: document.querySelector("#journalSwap"),
  journalNetResult: document.querySelector("#journalNetResult"),
  journalBalanceAfter: document.querySelector("#journalBalanceAfter"),
  journalDuration: document.querySelector("#journalDuration"),
  journalEntrySession: document.querySelector("#journalEntrySession"),
  journalExitSession: document.querySelector("#journalExitSession"),
  journalEntryLogic: document.querySelector("#journalEntryLogic"),
  journalExitLogic: document.querySelector("#journalExitLogic"),
  journalMistakes: document.querySelector("#journalMistakes"),
  journalLessonsLearned: document.querySelector("#journalLessonsLearned"),
  journalNotes: document.querySelector("#journalNotes"),
  journalErrorPanel: document.querySelector("#journalErrorPanel"),
  journalErrorList: document.querySelector("#journalErrorList"),
  saveJournalEntry: document.querySelector("#saveJournalEntry"),
  statTotalTrades: document.querySelector("#statTotalTrades"),
  statWinningTrades: document.querySelector("#statWinningTrades"),
  statLosingTrades: document.querySelector("#statLosingTrades"),
  statWinRate: document.querySelector("#statWinRate"),
  statTotalProfit: document.querySelector("#statTotalProfit"),
  statTotalLoss: document.querySelector("#statTotalLoss"),
  statNetPnl: document.querySelector("#statNetPnl"),
  statAverageRr: document.querySelector("#statAverageRr"),
  statBestTrade: document.querySelector("#statBestTrade"),
  statWorstTrade: document.querySelector("#statWorstTrade"),
  statTotalCommission: document.querySelector("#statTotalCommission"),
  statTotalSwap: document.querySelector("#statTotalSwap"),
  manageAccountsButton: document.querySelector("#manageAccountsButton"),
  manageAccountsCount: document.querySelector("#manageAccountsCount"),
  manageAccountsModal: document.querySelector("#manageAccountsModal"),
  closeManageAccounts: document.querySelector("#closeManageAccounts"),
  performanceScope: document.querySelector("#performanceScope"),
  journalEmpty: document.querySelector("#journalEmpty"),
  journalList: document.querySelector("#journalList"),
  journalFilters: document.querySelector("#journalFilters"),
  journalFilterModal: document.querySelector("#journalFilterModal"),
  closeJournalFilter: document.querySelector("#closeJournalFilter"),
  journalFilterAccount: document.querySelector("#journalFilterAccount"),
  journalFilterStart: document.querySelector("#journalFilterStart"),
  journalFilterEnd: document.querySelector("#journalFilterEnd"),
  journalFilterApply: document.querySelector("#journalFilterApply"),
  journalFilterCancel: document.querySelector("#journalFilterCancel"),
  journalFilterClearBtn: document.querySelector("#journalFilterClearBtn"),
  exportMenu: document.querySelector("#exportMenu"),
  exportToggle: document.querySelector("#exportToggle"),
  exportOptions: document.querySelector("#exportOptions"),
  exportFromDate: document.querySelector("#exportFromDate"),
  exportToDate: document.querySelector("#exportToDate"),
  exportIncludeReports: document.querySelector("#exportIncludeReports"),
  exportAccount: document.querySelector("#exportAccount"),
  sessionStatusCard: document.querySelector("#sessionStatusCard"),
  sessionClock: document.querySelector("#sessionClock"),
  sessionName: document.querySelector("#sessionName"),
  sessionOverlap: document.querySelector("#sessionOverlap"),
  journalDetailPanel: document.querySelector("#journalDetailPanel"),
  journalDetailContent: document.querySelector("#journalDetailContent"),
  closeJournalDetail: document.querySelector("#closeJournalDetail"),
  accountDeleteDialog: document.querySelector("#accountDeleteDialog"),
  cancelDeleteAccount: document.querySelector("#cancelDeleteAccount"),
  confirmDeleteAccount: document.querySelector("#confirmDeleteAccount"),
};

let activeUser = null;
// Journal History filters (persist until Clear or page refresh).
const journalFilters = { accountId: "", startDate: "", endDate: "" };
let performanceScopeId = "";
let currentJournalPreview = null;
let pendingDeleteAccountId = "";
let sessionClockTimer = null;
const expandedPropDashboards = new Set();

function getActiveUserId() {
  return activeUser ? activeUser.username : "";
}

function getEntryDirection(entry) {
  if (!Number.isFinite(Number(entry.entryPrice)) || !Number.isFinite(Number(entry.stopLoss))) {
    return null;
  }

  return Number(entry.stopLoss) < Number(entry.entryPrice) ? "Long" : "Short";
}

function renderSessionPill(label, key) {
  const safeKey = escapeHtml(key || "none");
  const safeLabel = escapeHtml(label || "--");
  return `<span class="session-pill" data-session="${safeKey}">${safeLabel}</span>`;
}

function populateSelects() {
  const instrumentOptions = Object.values(INSTRUMENTS)
    .map((instrument) => `<option value="${instrument.symbol}">${instrument.displayName}</option>`)
    .join("");

  elements.journalMarket.innerHTML = instrumentOptions;
}

function resetJournalForm() {
  elements.journalForm.reset();
  elements.journalMarket.value = DEFAULT_STATE.instrument;
  elements.journalEntryPrice.value = DEFAULT_STATE.entryPrice;
  elements.journalStopLoss.value = DEFAULT_STATE.stopLoss;
  elements.journalTakeProfit.value = DEFAULT_STATE.takeProfit;
  elements.journalLotSize.value = "0.01";
  elements.journalCommissionPerLot.value = "5";
  elements.journalSwapPaid.value = "0";
  elements.journalOutcome.value = "tp";
  elements.journalEntryTime.value = getIstDateTimeLocalValue();
  elements.journalExitTime.value = getIstDateTimeLocalValue();
  elements.journalExitPriceField.classList.add("is-hidden");
  elements.journalExitPrice.value = "";
  updateJournalPriceSteps();
}

function updateJournalPriceSteps() {
  const instrument = INSTRUMENTS[elements.journalMarket.value] || INSTRUMENTS.EURUSD;
  const priceStep = instrument.pointSize.toFixed(instrument.priceDecimals);

  elements.journalEntryPrice.step = priceStep;
  elements.journalStopLoss.step = priceStep;
  elements.journalTakeProfit.step = priceStep;
  elements.journalExitPrice.step = priceStep;
}

function renderPanelErrors(panel, list, errors) {
  list.innerHTML = errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("");
  panel.classList.toggle("is-hidden", errors.length === 0);
}

function getJournalAccounts() {
  return loadAccounts(getActiveUserId());
}

function getTargetProgressState(progress) {
  if (progress >= 100) {
    return "complete";
  }

  if (progress >= 50) {
    return "success";
  }

  return "neutral";
}

function getDrawdownProgressState(progress) {
  if (progress >= 100) {
    return "critical";
  }

  if (progress >= 80) {
    return "danger";
  }

  if (progress >= 50) {
    return "warning";
  }

  return "safe";
}

function renderAccountProgressPanel({ title, state, percent, values, action = "" }) {
  const clampedPercent = Math.min(Math.max(Number(percent) || 0, 0), 100);

  return `
    <section class="account-progress" data-progress-state="${state}">
      <div class="account-progress-heading">
        <strong>${escapeHtml(title)}</strong>
        <div class="account-progress-heading-actions">
          <span>${formatPercent(percent)}</span>
          ${action}
        </div>
      </div>
      <span class="account-progress-track">
        <span class="account-progress-fill" style="--account-progress: ${clampedPercent}%"></span>
      </span>
      <dl class="account-progress-values">
        ${values
          .map(
            ([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `,
          )
          .join("")}
      </dl>
    </section>
  `;
}

function renderPropFirmDashboard(account) {
  if (account.accountType !== "prop" || !account.propFirm) {
    return "";
  }

  const metrics = account.propFirm;
  const safeId = escapeHtml(account.id);
  const isExpanded = expandedPropDashboards.has(account.id);
  const drawdownId = `propDrawdown-${safeId}`;
  const toggleLabel = isExpanded ? "Hide Drawdown" : "Show Drawdown";
  const toggleButton = `
    <button class="button secondary prop-dashboard-toggle" type="button" data-account-action="toggle-prop-dashboard" data-id="${safeId}" aria-expanded="${String(isExpanded)}" aria-controls="${drawdownId}">
      ${toggleLabel}
    </button>
  `;

  return `
    <div class="prop-dashboard" aria-label="Prop firm progress dashboard">
      ${renderAccountProgressPanel({
        title: "Profit Target Progress",
        state: getTargetProgressState(metrics.targetProgressPercent),
        percent: metrics.targetProgressPercent,
        action: toggleButton,
        values: [
          ["Current", formatCurrency(account.currentBalance)],
          ["Target", formatCurrency(account.targetBalance)],
          ["Target %", formatPercent(account.targetPercent)],
          ["Remaining", formatCurrency(metrics.remainingTarget)],
        ],
      })}
      <div id="${drawdownId}" class="prop-drawdown-panels${isExpanded ? "" : " is-hidden"}">
        ${renderAccountProgressPanel({
          title: "Maximum Daily Drawdown",
          state: getDrawdownProgressState(metrics.dailyUsagePercent),
          percent: metrics.dailyUsagePercent,
          values: [
            ["Limit", formatCurrency(metrics.dailyDrawdownLimit)],
            ["Used", formatCurrency(metrics.dailyDrawdownUsed)],
            ["Remaining", formatCurrency(metrics.dailyDrawdownRemaining)],
            ["Minimum Balance", formatCurrency(metrics.dailyMinimumBalance)],
          ],
        })}
        ${renderAccountProgressPanel({
          title: "Maximum Overall Drawdown",
          state: getDrawdownProgressState(metrics.overallUsagePercent),
          percent: metrics.overallUsagePercent,
          values: [
            ["Limit", formatCurrency(metrics.overallDrawdownLimit)],
            ["Used", formatCurrency(metrics.overallDrawdownUsed)],
            ["Remaining", formatCurrency(metrics.overallDrawdownRemaining)],
            ["Minimum Balance", formatCurrency(metrics.minimumAllowedBalance)],
          ],
        })}
      </div>
    </div>
  `;
}

function updateAccountPhaseVisibility() {
  const isPropAccount = elements.accountType.value === "prop";

  elements.accountPhaseField.classList.toggle("is-hidden", !isPropAccount);
  elements.accountPhase.disabled = !isPropAccount;
}

function getSelectedJournalAccount() {
  const accountId = elements.journalAccount.value;
  return getJournalAccounts().find((account) => account.id === accountId) || null;
}

function readJournalInput() {
  const account = getSelectedJournalAccount();

  return {
    account,
    accountId: account ? account.id : "",
    market: elements.journalMarket.value,
    entryPrice: parseNumber(elements.journalEntryPrice.value),
    stopLoss: parseNumber(elements.journalStopLoss.value),
    takeProfit: parseNumber(elements.journalTakeProfit.value),
    lotSize: parseNumber(elements.journalLotSize.value),
    commissionPerLot: parseNumber(elements.journalCommissionPerLot.value),
    swapPaid: parseNumber(elements.journalSwapPaid.value),
    entryTime: elements.journalEntryTime.value,
    exitTime: elements.journalExitTime.value,
    outcome: elements.journalOutcome.value,
    exitPrice: parseNumber(elements.journalExitPrice.value),
    entryLogic: elements.journalEntryLogic.value.trim(),
    exitLogic: elements.journalExitLogic.value.trim(),
    mistakes: elements.journalMistakes.value.trim(),
    lessonsLearned: elements.journalLessonsLearned.value.trim(),
    notes: elements.journalNotes.value.trim(),
  };
}

function requirePositiveJournalNumber(input, fieldName, label, errors) {
  if (input[fieldName] === null) {
    errors.push(`${label} is required.`);
    return;
  }

  if (input[fieldName] <= 0) {
    errors.push(`${label} must be greater than 0.`);
  }
}

function validateJournalInput(input) {
  const errors = [];
  const instrument = INSTRUMENTS[input.market];

  if (!input.account) {
    errors.push("Create or choose a trading account.");
  }

  if (!instrument) {
    errors.push("Choose a supported market.");
  }

  requirePositiveJournalNumber(input, "entryPrice", "Entry price", errors);
  requirePositiveJournalNumber(input, "stopLoss", "Stop loss", errors);
  requirePositiveJournalNumber(input, "takeProfit", "Take profit", errors);
  requirePositiveJournalNumber(input, "lotSize", "Lot size", errors);

  if (input.commissionPerLot === null || input.commissionPerLot < 0) {
    errors.push("Commission per lot must be 0 or greater.");
  }

  if (!input.entryTime) {
    errors.push("Time of entry is required.");
  }

  if (!input.exitTime) {
    errors.push("Time of exit is required.");
  }

  if (input.entryTime && input.exitTime) {
    const entryMs = Date.parse(input.entryTime);
    const exitMs = Date.parse(input.exitTime);

    if (Number.isFinite(entryMs) && Number.isFinite(exitMs) && exitMs < entryMs) {
      errors.push("Time of exit cannot be before time of entry.");
    }
  }

  if (!Object.keys(OUTCOME_LABELS).includes(input.outcome)) {
    errors.push("Choose a valid trade outcome.");
  }

  if (input.outcome === "manual") {
    requirePositiveJournalNumber(input, "exitPrice", "Exit price", errors);
  }

  if (
    Number.isFinite(input.entryPrice) &&
    Number.isFinite(input.stopLoss) &&
    input.entryPrice === input.stopLoss
  ) {
    errors.push("Entry price and stop loss cannot be the same.");
  }

  if (
    Number.isFinite(input.entryPrice) &&
    Number.isFinite(input.stopLoss) &&
    Number.isFinite(input.takeProfit) &&
    input.entryPrice !== input.stopLoss
  ) {
    const isLong = input.stopLoss < input.entryPrice;
    const takeProfitOnRightSide = isLong
      ? input.takeProfit > input.entryPrice
      : input.takeProfit < input.entryPrice;

    if (!takeProfitOnRightSide) {
      errors.push("Take profit must be on the opposite side of entry from stop loss.");
    }
  }

  return {
    errors,
    isValid: errors.length === 0,
  };
}

function calculateJournalPreview(input) {
  const validation = validateJournalInput(input);
  const calculation = calculateFixedLotTrade({
    instrument: input.market,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    lotSize: input.lotSize,
  });

  const commissionPaid =
    Number.isFinite(input.lotSize) && Number.isFinite(input.commissionPerLot)
      ? input.lotSize * input.commissionPerLot
      : null;
  // Swap is optional and may be negative (broker-paid). Empty -> 0.
  const swapPaid = Number.isFinite(input.swapPaid) ? input.swapPaid : 0;
  const commissionCost = Number.isFinite(commissionPaid) ? commissionPaid : 0;

  if (!calculation) {
    return {
      input,
      validation,
      calculation: null,
      finalTradePnL: null,
      commissionPaid,
      swapPaid,
      netTradeResult: null,
      accountBalanceAfter: null,
    };
  }

  let finalTradePnL = null;

  if (input.outcome === "tp") {
    finalTradePnL = calculation.potentialProfit;
  }

  if (input.outcome === "sl") {
    finalTradePnL = -calculation.potentialLoss;
  }

  if (input.outcome === "manual" && Number.isFinite(input.exitPrice)) {
    finalTradePnL = calculateExitPnl({
      instrument: input.market,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      exitPrice: input.exitPrice,
      lotSize: input.lotSize,
    });
  }

  const netTradeResult = Number.isFinite(finalTradePnL)
    ? finalTradePnL - commissionCost - swapPaid
    : null;

  return {
    input,
    validation,
    calculation,
    finalTradePnL,
    commissionPaid,
    swapPaid,
    netTradeResult,
    accountBalanceAfter:
      input.account && Number.isFinite(finalTradePnL)
        ? input.account.currentBalance + finalTradePnL - commissionCost - swapPaid
        : null,
  };
}

function renderJournalPreview(preview) {
  currentJournalPreview = preview;

  const { input } = preview;
  const entrySession = describeSessionForDateTimeLocal(input.entryTime);
  const exitSession = describeSessionForDateTimeLocal(input.exitTime);
  const durationMinutes = tradeDurationMinutes(input.entryTime, input.exitTime);

  setText(elements.journalDuration, formatDuration(durationMinutes));
  setText(elements.journalEntrySession, entrySession ? entrySession.label : "--");
  setText(elements.journalExitSession, exitSession ? exitSession.label : "--");
  setText(
    elements.journalCommission,
    Number.isFinite(preview.commissionPaid) ? formatSignedCurrency(-preview.commissionPaid) : "--",
  );
  setSignedClass(elements.journalCommission, Number.isFinite(preview.commissionPaid) ? -preview.commissionPaid : 0);
  setText(
    elements.journalSwap,
    Number.isFinite(preview.swapPaid) ? formatSignedCurrency(-preview.swapPaid) : "--",
  );
  setSignedClass(elements.journalSwap, Number.isFinite(preview.swapPaid) ? -preview.swapPaid : 0);
  setText(
    elements.journalNetResult,
    Number.isFinite(preview.netTradeResult) ? formatSignedCurrency(preview.netTradeResult) : "--",
  );
  setSignedClass(elements.journalNetResult, Number.isFinite(preview.netTradeResult) ? preview.netTradeResult : 0);

  if (!preview.calculation) {
    [
      elements.journalPotentialProfit,
      elements.journalPotentialLoss,
      elements.journalRiskReward,
      elements.journalFinalPnl,
      elements.journalBalanceAfter,
    ].forEach((element) => setText(element, "--"));
    setSignedClass(elements.journalFinalPnl, 0);
    setSignedClass(elements.journalBalanceAfter, 0);
    return;
  }

  setText(elements.journalPotentialProfit, formatSignedCurrency(preview.calculation.potentialProfit));
  setText(elements.journalPotentialLoss, formatSignedCurrency(-preview.calculation.potentialLoss));
  setText(elements.journalRiskReward, formatRatio(preview.calculation.riskRewardRatio));
  setText(
    elements.journalFinalPnl,
    Number.isFinite(preview.finalTradePnL)
      ? formatSignedCurrency(preview.finalTradePnL)
      : "--",
  );
  setText(
    elements.journalBalanceAfter,
    Number.isFinite(preview.accountBalanceAfter)
      ? formatCurrency(preview.accountBalanceAfter)
      : "--",
  );
  setSignedClass(elements.journalFinalPnl, preview.finalTradePnL || 0);
  setSignedClass(elements.journalBalanceAfter, preview.accountBalanceAfter - preview.input.account?.currentBalance || 0);
}

function updateJournalPreview(options = {}) {
  updateJournalPriceSteps();
  elements.journalExitPriceField.classList.toggle("is-hidden", elements.journalOutcome.value !== "manual");

  const preview = calculateJournalPreview(readJournalInput());
  renderJournalPreview(preview);

  if (options.showErrors) {
    renderPanelErrors(elements.journalErrorPanel, elements.journalErrorList, preview.validation.errors);
  }

  return preview;
}

function setJournalFormDisabled(isDisabled) {
  [
    elements.journalAccount,
    elements.journalMarket,
    elements.journalEntryPrice,
    elements.journalStopLoss,
    elements.journalTakeProfit,
    elements.journalLotSize,
    elements.journalEntryTime,
    elements.journalExitTime,
    elements.journalOutcome,
    elements.journalExitPrice,
    elements.journalEntryLogic,
    elements.journalExitLogic,
    elements.journalMistakes,
    elements.journalLessonsLearned,
    elements.journalNotes,
    elements.saveJournalEntry,
  ].forEach((element) => {
    element.disabled = isDisabled;
  });
}

function renderJournalAccountOptions(accounts) {
  if (accounts.length === 0) {
    elements.journalAccount.innerHTML = '<option value="">Create account first</option>';
    setJournalFormDisabled(true);
    return;
  }

  const selectedAccountId = elements.journalAccount.value;
  elements.journalAccount.innerHTML = accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");
  elements.journalAccount.value =
    accounts.some((account) => account.id === selectedAccountId)
      ? selectedAccountId
      : accounts[0].id;
  setJournalFormDisabled(false);
}

function renderAccounts(accounts, entries = []) {
  elements.journalAccountEmpty.classList.toggle("is-hidden", accounts.length > 0);

  if (accounts.length === 0) {
    elements.accountsList.innerHTML = '<p class="empty-state">No trading accounts yet.</p>';
    return;
  }

  const commissionByAccount = new Map();
  const swapByAccount = new Map();
  entries.forEach((entry) => {
    const currentCommission = commissionByAccount.get(entry.accountId) || 0;
    commissionByAccount.set(entry.accountId, currentCommission + (Number(entry.commissionPaid) || 0));
    const currentSwap = swapByAccount.get(entry.accountId) || 0;
    swapByAccount.set(entry.accountId, currentSwap + (Number(entry.swapPaid) || 0));
  });

  elements.accountsList.innerHTML = accounts
    .map(
      (account) => {
        const safeId = escapeHtml(account.id);
        const targetReached = account.accountStatus === "PASSED";
        const accountStatus =
          account.accountType === "prop"
            ? account.accountStatus || "ACTIVE"
            : "";
        const phaseMarkup =
          account.accountType === "prop"
            ? `<span>${escapeHtml(PHASE_LABELS[account.phase] || "Phase 1")} · Target ${formatPercent(account.targetPercent)}</span>`
            : "";
        const statusMarkup =
          account.accountType === "prop"
            ? `<span class="account-status-badge" data-status="${escapeHtml(accountStatus)}">${escapeHtml(ACCOUNT_STATUS_LABELS[accountStatus] || ACCOUNT_STATUS_LABELS.ACTIVE)}</span>`
            : "";
        const propDashboard = renderPropFirmDashboard(account);

        return `
          <article class="account-card" data-account-id="${safeId}">
            <div class="account-card-main">
              <div>
                <div class="account-title-row">
                  <strong>${escapeHtml(account.name)}</strong>
                  ${targetReached ? '<span class="target-badge">Target Reached</span>' : ""}
                  ${statusMarkup}
                </div>
                <span>${escapeHtml(ACCOUNT_TYPE_LABELS[account.accountType] || "Live Account")}</span>
                ${phaseMarkup}
              </div>
              <div class="account-balance-grid">
                <div>
                  <span>Initial Balance</span>
                  <strong>${formatCurrency(account.initialBalance)}</strong>
                </div>
                <div>
                  <span>Current Balance</span>
                  <strong>${formatCurrency(account.currentBalance)}</strong>
                </div>
                <div>
                  <span>Commission Paid</span>
                  <strong>${formatCurrency(commissionByAccount.get(account.id) || 0)}</strong>
                </div>
                <div>
                  <span>Swap Paid</span>
                  <strong>${formatSignedCurrency(swapByAccount.get(account.id) || 0)}</strong>
                </div>
                ${
                  account.accountType === "prop"
                    ? `<div>
                        <span>Target Balance</span>
                        <strong>${formatCurrency(account.targetBalance)}</strong>
                      </div>`
                    : ""
                }
              </div>
              ${propDashboard}
            </div>
            <button class="button danger account-delete-button" type="button" data-account-action="delete" data-id="${safeId}" aria-label="Delete ${escapeHtml(account.name)}">Delete</button>
          </article>
        `;
      },
    )
    .join("");
}

function calculateStats(entries) {
  const totalTrades = entries.length;
  const winningTrades = entries.filter((entry) => entry.finalTradePnL > 0).length;
  const losingTrades = entries.filter((entry) => entry.finalTradePnL < 0).length;
  const totalProfit = entries.reduce(
    (sum, entry) => sum + Math.max(Number(entry.finalTradePnL) || 0, 0),
    0,
  );
  const totalLoss = entries.reduce(
    (sum, entry) => sum + Math.min(Number(entry.finalTradePnL) || 0, 0),
    0,
  );
  const riskRewards = entries
    .map((entry) => Number(entry.riskReward))
    .filter((value) => Number.isFinite(value));
  const bestTrade = entries.reduce(
    (best, entry) => Math.max(best, Number(entry.finalTradePnL) || 0),
    0,
  );
  const worstTrade = entries.reduce(
    (worst, entry) => Math.min(worst, Number(entry.finalTradePnL) || 0),
    0,
  );
  const totalCommission = entries.reduce(
    (sum, entry) => sum + (Number(entry.commissionPaid) || 0),
    0,
  );
  const totalSwap = entries.reduce(
    (sum, entry) => sum + (Number(entry.swapPaid) || 0),
    0,
  );

  return {
    totalTrades,
    totalCommission,
    totalSwap,
    winningTrades,
    losingTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null,
    totalProfit,
    totalLoss,
    netPnl: totalProfit + totalLoss,
    averageRr:
      riskRewards.length > 0
        ? riskRewards.reduce((sum, value) => sum + value, 0) / riskRewards.length
        : null,
    bestTrade,
    worstTrade,
  };
}

function renderStats(entries) {
  const stats = calculateStats(entries);

  setText(elements.statTotalTrades, String(stats.totalTrades));
  setText(elements.statWinningTrades, String(stats.winningTrades));
  setText(elements.statLosingTrades, String(stats.losingTrades));
  setText(elements.statWinRate, stats.winRate === null ? "--" : formatPercent(stats.winRate));
  setText(elements.statTotalProfit, formatSignedCurrency(stats.totalProfit));
  setText(elements.statTotalLoss, formatSignedCurrency(stats.totalLoss));
  setText(elements.statNetPnl, formatSignedCurrency(stats.netPnl));
  setText(elements.statAverageRr, stats.averageRr === null ? "--" : formatRatio(stats.averageRr));
  setText(elements.statBestTrade, stats.totalTrades === 0 ? "--" : formatSignedCurrency(stats.bestTrade));
  setText(elements.statWorstTrade, stats.totalTrades === 0 ? "--" : formatSignedCurrency(stats.worstTrade));
  setText(elements.statTotalCommission, formatCurrency(stats.totalCommission));
  setText(elements.statTotalSwap, formatSignedCurrency(stats.totalSwap));
  setSignedClass(elements.statNetPnl, stats.netPnl);
  setSignedClass(elements.statBestTrade, stats.bestTrade);
  setSignedClass(elements.statWorstTrade, stats.worstTrade);
}

function getEntryDateKey(entry) {
  return String(entry.entryTime || entry.createdAt || "").slice(0, 10);
}

function journalFiltersActive() {
  return Boolean(journalFilters.accountId || journalFilters.startDate || journalFilters.endDate);
}

// Display-only: filter the shown rows by account + date range. Stats/exports
// still operate on the full entry set.
function applyJournalFilters(entries) {
  return entries.filter((entry) => {
    if (journalFilters.accountId && entry.accountId !== journalFilters.accountId) {
      return false;
    }

    const key = getEntryDateKey(entry);

    if (journalFilters.startDate && key < journalFilters.startDate) {
      return false;
    }

    if (journalFilters.endDate && key > journalFilters.endDate) {
      return false;
    }

    return true;
  });
}

function renderJournalEntries(entries) {
  const visibleEntries = applyJournalFilters(entries);

  elements.journalEmpty.classList.toggle("is-hidden", visibleEntries.length > 0);

  if (visibleEntries.length === 0) {
    elements.journalEmpty.textContent = journalFiltersActive()
      ? "No journal entries match the selected filters."
      : "No journal entries yet.";
    elements.journalList.innerHTML = "";
    return;
  }

  elements.journalList.innerHTML = visibleEntries
    .map((entry) => {
      const safeId = escapeHtml(entry.id);
      const finalPnl = Number(entry.finalTradePnL) || 0;
      const direction = getEntryDirection(entry);
      const directionClass = direction === "Long" ? "is-long" : direction === "Short" ? "is-short" : "";

      return `
        <article class="journal-row" data-id="${safeId}">
          <div>
            <strong>${escapeHtml(formatDateTime(entry.entryTime || entry.createdAt))}</strong>
            <span>Date</span>
          </div>
          <div>
            <strong>${escapeHtml(entry.market)}</strong>
            <span>Market</span>
          </div>
          <div>
            <strong class="${directionClass}">${escapeHtml(direction || "--")}</strong>
            <span>Direction</span>
          </div>
          <div>
            <strong>${escapeHtml(formatTimeOnly(entry.entryTime))} &rarr; ${escapeHtml(formatTimeOnly(entry.exitTime))}</strong>
            <span>Entry &rarr; Exit (IST)</span>
          </div>
          <div>
            ${renderSessionPill(entry.entrySessionLabel, entry.entrySessionKey)}
            <span>Entry Session</span>
          </div>
          <div>
            ${renderSessionPill(entry.exitSessionLabel, entry.exitSessionKey)}
            <span>Exit Session</span>
          </div>
          <div>
            <strong>${escapeHtml(formatDuration(entry.durationMinutes))}</strong>
            <span>Duration</span>
          </div>
          <div>
            <strong>${escapeHtml(OUTCOME_LABELS[entry.outcome] || entry.outcome)}</strong>
            <span>Outcome</span>
          </div>
          <div>
            <strong class="${finalPnl >= 0 ? "positive" : "negative"}">${formatSignedCurrency(finalPnl)}</strong>
            <span>Final PnL</span>
          </div>
          <div class="journal-actions">
            <button class="button secondary" type="button" data-journal-action="view" data-id="${safeId}">View</button>
            <button class="button danger" type="button" data-journal-action="delete" data-id="${safeId}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateSessionStatus() {
  if (!elements.sessionStatusCard) {
    return;
  }

  const session = describeCurrentSession();

  setText(elements.sessionClock, formatIstClock());

  if (!session) {
    return;
  }

  const isOverlap = session.sessions.length > 1;
  const primaryKey = isOverlap ? "overlap" : session.key;

  elements.sessionStatusCard.dataset.session = primaryKey;
  setText(elements.sessionName, session.label);

  if (isOverlap) {
    elements.sessionOverlap.textContent = "Overlap Active";
    elements.sessionOverlap.classList.remove("is-hidden");
  } else {
    elements.sessionOverlap.textContent = "";
    elements.sessionOverlap.classList.add("is-hidden");
  }
}

function startSessionClock() {
  updateSessionStatus();

  if (sessionClockTimer === null) {
    sessionClockTimer = window.setInterval(updateSessionStatus, 1000);
  }
}

function closeExportMenu() {
  if (!elements.exportOptions) {
    return;
  }

  elements.exportOptions.classList.add("is-hidden");
  elements.exportToggle.setAttribute("aria-expanded", "false");
}

function toggleExportMenu() {
  if (!elements.exportOptions) {
    return;
  }

  const willOpen = elements.exportOptions.classList.contains("is-hidden");
  elements.exportOptions.classList.toggle("is-hidden", !willOpen);
  elements.exportToggle.setAttribute("aria-expanded", String(willOpen));
}

async function handleExportAction(event) {
  const option = event.target.closest("[data-export]");

  if (!option) {
    return;
  }

  const allEntries = loadJournalEntries(getActiveUserId());
  const accountId = elements.exportAccount ? elements.exportAccount.value : "";
  // Account filter: empty = All Accounts. Applies to entries and rule reports.
  const entries = accountId
    ? allEntries.filter((entry) => entry.accountId === accountId)
    : allEntries;

  if (entries.length === 0) {
    showToast("No journal entries to export.");
    closeExportMenu();
    return;
  }

  const fromDate = elements.exportFromDate ? elements.exportFromDate.value : "";
  const toDate = elements.exportToDate ? elements.exportToDate.value : "";
  const includeRuleReports = Boolean(elements.exportIncludeReports && elements.exportIncludeReports.checked);

  let ruleReports = [];

  if (includeRuleReports) {
    try {
      ruleReports = await getDailyRuleReportsInRange(fromDate, toDate);

      if (accountId) {
        ruleReports = ruleReports.filter((report) => report.accountId === accountId);
      }
    } catch (error) {
      console.error("Could not load rule reports for export:", error.message);
      showToast("Could not load rule reports; exporting trades only.");
    }
  }

  const options = { fromDate, toDate, includeRuleReports, ruleReports };

  if (option.dataset.export === "csv") {
    exportJournalCsv(entries, activeUser, options);
    showToast("Journal exported as CSV.");
  }

  if (option.dataset.export === "pdf") {
    exportJournalPdf(entries, activeUser, options);
    showToast("Preparing PDF export...");
  }

  closeExportMenu();
}

// Keeps the Performance Scope dropdown in sync with the user's accounts while
// preserving the current selection (falls back to Overall if it disappeared).
function renderPerformanceScopeOptions(accounts) {
  if (!elements.performanceScope) {
    return;
  }

  const stillExists = accounts.some((account) => account.id === performanceScopeId);

  if (!stillExists) {
    performanceScopeId = "";
  }

  const options = [
    '<option value="">Overall Performance</option>',
    ...accounts.map(
      (account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`,
    ),
  ].join("");

  elements.performanceScope.innerHTML = options;
  elements.performanceScope.value = performanceScopeId;
}

// Journal filter modal account dropdown (includes "All Accounts").
function renderJournalFilterAccountOptions(accounts) {
  if (!elements.journalFilterAccount) {
    return;
  }

  const stillExists = accounts.some((account) => account.id === journalFilters.accountId);

  if (!stillExists) {
    journalFilters.accountId = "";
  }

  elements.journalFilterAccount.innerHTML = [
    '<option value="">All Accounts</option>',
    ...accounts.map(
      (account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`,
    ),
  ].join("");
  elements.journalFilterAccount.value = journalFilters.accountId;
}

function openJournalFilterModal() {
  // Seed the controls with the active filter state.
  elements.journalFilterAccount.value = journalFilters.accountId;
  elements.journalFilterStart.value = journalFilters.startDate;
  elements.journalFilterEnd.value = journalFilters.endDate;
  elements.journalFilterModal.classList.remove("is-hidden");
  document.body.classList.add("is-modal-open");
}

function closeJournalFilterModal() {
  elements.journalFilterModal.classList.add("is-hidden");
  document.body.classList.remove("is-modal-open");
}

function applyJournalFilterModal() {
  journalFilters.accountId = elements.journalFilterAccount.value;
  journalFilters.startDate = elements.journalFilterStart.value;
  journalFilters.endDate = elements.journalFilterEnd.value;
  closeJournalFilterModal();
  renderJournal();
}

function clearJournalFilterModal() {
  journalFilters.accountId = "";
  journalFilters.startDate = "";
  journalFilters.endDate = "";
  elements.journalFilterAccount.value = "";
  elements.journalFilterStart.value = "";
  elements.journalFilterEnd.value = "";
  renderJournal();
}

// Export popup account dropdown (includes "All Accounts"); selection preserved.
function renderExportAccountOptions(accounts) {
  if (!elements.exportAccount) {
    return;
  }

  const previous = elements.exportAccount.value;
  elements.exportAccount.innerHTML = [
    '<option value="">All Accounts</option>',
    ...accounts.map(
      (account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`,
    ),
  ].join("");

  const stillExists = accounts.some((account) => account.id === previous);
  elements.exportAccount.value = stillExists ? previous : "";
}

function renderJournal() {
  if (!activeUser) {
    return;
  }

  const { accounts, entries } = recalculateUserJournal(getActiveUserId());

  renderAccounts(accounts, entries);
  renderJournalAccountOptions(accounts);
  renderPerformanceScopeOptions(accounts);
  renderJournalFilterAccountOptions(accounts);
  renderExportAccountOptions(accounts);

  if (elements.manageAccountsCount) {
    setText(elements.manageAccountsCount, String(accounts.length));
  }

  // Performance Scope only filters the data source feeding the stats; the
  // calculation itself is unchanged. Empty scope = overall (every account).
  const scopedEntries = performanceScopeId
    ? entries.filter((entry) => entry.accountId === performanceScopeId)
    : entries;

  renderStats(scopedEntries);
  renderJournalEntries(entries);
  renderPanelErrors(elements.accountErrorPanel, elements.accountErrorList, []);
  renderPanelErrors(elements.journalErrorPanel, elements.journalErrorList, []);
  updateJournalPreview();
  refreshRuleBook();
  refreshRuleReports();
}

async function handleAccountSubmit(event) {
  event.preventDefault();

  const name = elements.accountName.value.trim();
  const accountType = elements.accountType.value;
  const phase = accountType === "prop" ? elements.accountPhase.value : "";
  const initialBalance = parseNumber(elements.accountInitialBalance.value);
  const currentBalance = parseNumber(elements.accountCurrentBalance.value);
  const errors = [];

  if (!name) {
    errors.push("Account name is required.");
  }

  if (!Object.keys(ACCOUNT_TYPE_LABELS).includes(accountType)) {
    errors.push("Choose a valid account type.");
  }

  if (accountType === "prop" && !Object.keys(PHASE_LABELS).includes(phase)) {
    errors.push("Choose a valid prop firm phase.");
  }

  if (initialBalance === null || initialBalance <= 0) {
    errors.push("Initial balance must be greater than 0.");
  }

  if (currentBalance === null || currentBalance <= 0) {
    errors.push("Current account balance must be greater than 0.");
  }

  renderPanelErrors(elements.accountErrorPanel, elements.accountErrorList, errors);

  if (errors.length > 0) {
    return;
  }

  await createAccount(getActiveUserId(), {
    name,
    accountType,
    phase,
    initialBalance,
    currentBalance,
  });
  elements.accountForm.reset();
  updateAccountPhaseVisibility();
  renderJournal();
  showToast("Trading account created.");
}

function openManageAccounts() {
  elements.manageAccountsModal.classList.remove("is-hidden");
  document.body.classList.add("is-modal-open");
  elements.closeManageAccounts.focus();
}

function closeManageAccounts() {
  elements.manageAccountsModal.classList.add("is-hidden");
  // Keep the page locked if the delete confirmation is still open.
  if (elements.accountDeleteDialog.classList.contains("is-hidden")) {
    document.body.classList.remove("is-modal-open");
  }
}

function showAccountDeleteDialog(accountId) {
  pendingDeleteAccountId = accountId;
  elements.accountDeleteDialog.classList.remove("is-hidden");
  document.body.classList.add("is-modal-open");
  elements.confirmDeleteAccount.focus();
}

function hideAccountDeleteDialog() {
  pendingDeleteAccountId = "";
  elements.accountDeleteDialog.classList.add("is-hidden");
  // Release the page scroll lock unless the accounts modal is still open.
  if (elements.manageAccountsModal.classList.contains("is-hidden")) {
    document.body.classList.remove("is-modal-open");
  }
}

function handleAccountAction(event) {
  const button = event.target.closest("button[data-account-action]");

  if (!button) {
    return;
  }

  if (button.dataset.accountAction === "delete") {
    showAccountDeleteDialog(button.dataset.id);
  }

  if (button.dataset.accountAction === "toggle-prop-dashboard") {
    const accountId = button.dataset.id;

    if (expandedPropDashboards.has(accountId)) {
      expandedPropDashboards.delete(accountId);
    } else {
      expandedPropDashboards.add(accountId);
    }

    renderJournal();
  }
}

async function confirmAccountDelete() {
  if (!pendingDeleteAccountId) {
    return;
  }

  await deleteAccount(getActiveUserId(), pendingDeleteAccountId);
  expandedPropDashboards.delete(pendingDeleteAccountId);
  hideAccountDeleteDialog();
  hideJournalDetail();
  renderJournal();
  showToast("Account and linked journal entries deleted.");
}

async function handleJournalSubmit(event) {
  event.preventDefault();

  const preview = updateJournalPreview({ showErrors: true });

  if (!preview.validation.isValid || !preview.calculation || !Number.isFinite(preview.finalTradePnL)) {
    return;
  }

  const { input, calculation } = preview;

  await addJournalEntry(getActiveUserId(), {
    accountId: input.account.id,
    accountName: input.account.name,
    market: input.market,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    exitPrice: input.outcome === "manual" ? input.exitPrice : null,
    lotSize: input.lotSize,
    potentialProfit: roundMoney(calculation.potentialProfit),
    potentialLoss: roundMoney(calculation.potentialLoss),
    riskReward: calculation.riskRewardRatio,
    outcome: input.outcome,
    finalTradePnL: roundMoney(preview.finalTradePnL),
    commissionPerLot: roundMoney(input.commissionPerLot),
    commissionPaid: roundMoney(input.lotSize * input.commissionPerLot),
    swapPaid: roundMoney(Number.isFinite(input.swapPaid) ? input.swapPaid : 0),
    netTradeResult: roundMoney(
      preview.finalTradePnL -
        input.lotSize * input.commissionPerLot -
        (Number.isFinite(input.swapPaid) ? input.swapPaid : 0),
    ),
    accountBalanceBefore: roundMoney(input.account.currentBalance),
    accountBalanceAfter: roundMoney(
      input.account.currentBalance +
        preview.finalTradePnL -
        input.lotSize * input.commissionPerLot -
        (Number.isFinite(input.swapPaid) ? input.swapPaid : 0),
    ),
    entryLogic: input.entryLogic,
    exitLogic: input.exitLogic,
    mistakes: input.mistakes,
    lessonsLearned: input.lessonsLearned,
    notes: input.notes,
    entryTime: input.entryTime,
    exitTime: input.exitTime,
  });

  resetJournalForm();
  renderJournal();
  showToast("Journal entry saved.");
}

function hideJournalDetail() {
  elements.journalDetailPanel.classList.add("is-hidden");
  elements.journalDetailContent.innerHTML = "";
}

function getEntryNetResult(entry) {
  if (Number.isFinite(Number(entry.netTradeResult))) {
    return Number(entry.netTradeResult);
  }

  return (
    (Number(entry.finalTradePnL) || 0) -
    (Number(entry.commissionPaid) || 0) -
    (Number(entry.swapPaid) || 0)
  );
}

function renderJournalDetail(entry) {
  const instrument = INSTRUMENTS[entry.market] || INSTRUMENTS.EURUSD;
  const direction = getEntryDirection(entry);
  const detailRows = [
    ["Trade Date", formatDateTime(entry.entryTime || entry.createdAt)],
    ["Account", entry.accountName],
    ["Market", entry.market],
    ["Direction", direction || "--"],
    ["Outcome", OUTCOME_LABELS[entry.outcome] || entry.outcome],
    ["Entry Time (IST)", entry.entryTime ? formatDateTime(entry.entryTime) : "--"],
    ["Exit Time (IST)", entry.exitTime ? formatDateTime(entry.exitTime) : "--"],
    ["Entry Session", entry.entrySessionLabel || "--"],
    ["Exit Session", entry.exitSessionLabel || "--"],
    ["Trade Duration", formatDuration(entry.durationMinutes)],
    ["Entry Price", formatPrice(entry.entryPrice, instrument)],
    ["Stop Loss", formatPrice(entry.stopLoss, instrument)],
    ["Take Profit", formatPrice(entry.takeProfit, instrument)],
    ["Exit Price", entry.exitPrice ? formatPrice(entry.exitPrice, instrument) : "--"],
    ["Lot Size", formatLot(entry.lotSize)],
    ["Potential Profit", formatSignedCurrency(Number(entry.potentialProfit) || 0)],
    ["Potential Loss", formatSignedCurrency(-(Number(entry.potentialLoss) || 0))],
    ["Risk Reward", formatRatio(Number(entry.riskReward) || 0)],
    ["Final Trade PnL", formatSignedCurrency(Number(entry.finalTradePnL) || 0)],
    ["Commission Per Lot", formatCurrency(Number(entry.commissionPerLot) || 0)],
    ["Commission Paid", formatCurrency(Number(entry.commissionPaid) || 0)],
    ["Swap Paid", formatSignedCurrency(Number(entry.swapPaid) || 0)],
    ["Net Trade Result", formatSignedCurrency(getEntryNetResult(entry))],
    ["Balance Before", formatCurrency(entry.accountBalanceBefore)],
    ["Balance After", formatCurrency(entry.accountBalanceAfter)],
  ];
  const noteRows = [
    ["Entry Logic", entry.entryLogic],
    ["Exit Logic", entry.exitLogic],
    ["Mistakes", entry.mistakes],
    ["Lessons Learned", entry.lessonsLearned],
    ["Additional Notes", entry.notes],
  ];

  elements.journalDetailContent.innerHTML = `
    <dl class="summary-list detail-list">
      ${detailRows
        .map(
          ([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
    <div class="notes-review">
      ${noteRows
        .map(
          ([label, value]) => `
            <section>
              <h3>${escapeHtml(label)}</h3>
              <p>${escapeHtml(value || "--")}</p>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
  elements.journalDetailPanel.classList.remove("is-hidden");
  elements.journalDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleJournalAction(event) {
  const button = event.target.closest("button[data-journal-action]");

  if (!button) {
    return;
  }

  const entryId = button.dataset.id;
  const entries = loadJournalEntries(getActiveUserId());
  const entry = entries.find((item) => item.id === entryId);

  if (!entry) {
    return;
  }

  if (button.dataset.journalAction === "view") {
    renderJournalDetail(entry);
    return;
  }

  if (button.dataset.journalAction === "delete") {
    const shouldDelete = window.confirm("Delete this journal entry?");

    if (!shouldDelete) {
      return;
    }

    await deleteJournalEntry(getActiveUserId(), entryId);
    hideJournalDetail();
    renderJournal();
    showToast("Journal entry deleted.");
  }
}

function attachEvents() {
  const journalLiveInputs = [
    elements.journalAccount,
    elements.journalMarket,
    elements.journalEntryPrice,
    elements.journalStopLoss,
    elements.journalTakeProfit,
    elements.journalLotSize,
    elements.journalEntryTime,
    elements.journalExitTime,
    elements.journalOutcome,
    elements.journalExitPrice,
  ];

  journalLiveInputs.forEach((element) => {
    element.addEventListener("input", () => updateJournalPreview());
    element.addEventListener("change", () => updateJournalPreview());
  });

  elements.accountForm.addEventListener("submit", handleAccountSubmit);
  elements.accountType.addEventListener("change", updateAccountPhaseVisibility);
  elements.accountsList.addEventListener("click", handleAccountAction);

  if (elements.manageAccountsButton) {
    elements.manageAccountsButton.addEventListener("click", openManageAccounts);
  }

  if (elements.closeManageAccounts) {
    elements.closeManageAccounts.addEventListener("click", closeManageAccounts);
  }

  if (elements.manageAccountsModal) {
    elements.manageAccountsModal.addEventListener("click", (event) => {
      if (event.target === elements.manageAccountsModal) {
        closeManageAccounts();
      }
    });
  }

  if (elements.performanceScope) {
    elements.performanceScope.addEventListener("change", () => {
      performanceScopeId = elements.performanceScope.value;
      renderJournal();
    });
  }
  elements.cancelDeleteAccount.addEventListener("click", hideAccountDeleteDialog);
  elements.confirmDeleteAccount.addEventListener("click", confirmAccountDelete);
  elements.accountDeleteDialog.addEventListener("click", (event) => {
    if (event.target === elements.accountDeleteDialog) {
      hideAccountDeleteDialog();
    }
  });
  elements.journalForm.addEventListener("submit", handleJournalSubmit);
  elements.journalList.addEventListener("click", handleJournalAction);
  elements.closeJournalDetail.addEventListener("click", hideJournalDetail);

  if (elements.exportToggle) {
    elements.exportToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExportMenu();
    });
  }

  if (elements.exportOptions) {
    elements.exportOptions.addEventListener("click", handleExportAction);
  }

  document.addEventListener("click", (event) => {
    if (elements.exportMenu && !elements.exportMenu.contains(event.target)) {
      closeExportMenu();
    }
  });

  if (elements.journalFilters) {
    elements.journalFilters.addEventListener("click", openJournalFilterModal);
    elements.closeJournalFilter.addEventListener("click", closeJournalFilterModal);
    elements.journalFilterCancel.addEventListener("click", closeJournalFilterModal);
    elements.journalFilterApply.addEventListener("click", applyJournalFilterModal);
    elements.journalFilterClearBtn.addEventListener("click", clearJournalFilterModal);
    elements.journalFilterModal.addEventListener("click", (event) => {
      if (event.target === elements.journalFilterModal) {
        closeJournalFilterModal();
      }
    });
  }
}

async function init() {
  activeUser = await requireAuth();

  if (!activeUser) {
    return;
  }

  // Hydrate the in-memory cache from Supabase (runs the one-time localStorage
  // migration first) before any synchronous render reads it.
  try {
    await initUserData(getActiveUserId());
  } catch (error) {
    showToast("Could not load your journal data. Please refresh.");
    console.error("initUserData failed:", error.message);
  }

  mountSharedComponents();
  initTheme();
  initLogout();
  populateSelects();
  resetJournalForm();
  updateAccountPhaseVisibility();
  attachEvents();
  setupTabs("journal", { defaultTarget: "tabNewEntry" });
  setupRuleBook({ getActiveUserId });
  await setupRuleReports({ getActiveUserId });
  renderJournal();
  startSessionClock();
  setupScrollReveal();
}

init();
