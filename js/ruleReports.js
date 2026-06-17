// =============================================================================
// Daily Rule Reports — historical rule-book performance.
// =============================================================================
//
// Each report captures, for one account on one day: the three predefined rule
// results, the custom-rule outcomes, and an overall score (passed / total).
// Reports are keyed `<accountId>:<reportDate>` so saving the same day again
// UPDATES the report rather than creating a duplicate.
//
// Day rollover: on load (and at local midnight) any past day that still has a
// rule book "tracking" marker is archived (saved as a non-manual report) and the
// rule book is reset for the new day — the predefined rules naturally reset
// because they recompute from each day's journal data, and custom-rule statuses
// are cleared. All rule calculations are reused from rulebook.js (no duplication).
// =============================================================================

import {
  getDailyRuleReports,
  upsertDailyRuleReport,
} from "./database.js";
import { evaluateAccountRules, scoreRuleResults } from "./rulebook.js";
import { loadAccounts, updateAccountRuleBook } from "./journal.js";
import { escapeHtml, getIstDateTimeLocalValue, showToast } from "./dom-utils.js";

const elements = {};
let ctx = null;
let selectedAccountId = "";
let reportsCache = [];
let midnightTimer = null;
// Rule Report History filters (persist until Clear or refresh).
const reportFilters = { startDate: "", endDate: "" };
// UI-only: which report cards have their custom-rules list expanded. Never
// persisted — purely local display state, multiple cards may be open at once.
const expandedReports = new Set();

function getActiveUserId() {
  return ctx && typeof ctx.getActiveUserId === "function" ? ctx.getActiveUserId() : "";
}

function todayKey() {
  return getIstDateTimeLocalValue().slice(0, 10);
}

// --- Report building --------------------------------------------------------

function buildReport(userId, accountId, dateKey, savedManually) {
  const evaluation = evaluateAccountRules(userId, accountId, dateKey);
  const score = scoreRuleResults(evaluation.predefined, evaluation.customRules);
  const existing = reportsCache.find((report) => report.id === `${accountId}:${evaluation.reportDate}`);
  const now = new Date().toISOString();

  return {
    id: `${accountId}:${evaluation.reportDate}`,
    accountId,
    accountName: evaluation.accountName,
    reportDate: evaluation.reportDate,
    dailyRisk: evaluation.predefined[0],
    riskPerTrade: evaluation.predefined[1],
    tradesPerDay: evaluation.predefined[2],
    customRules: evaluation.customRules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      status: rule.status,
    })),
    passedRules: score.passedRules,
    totalRules: score.totalRules,
    overallScorePercent: score.overallScorePercent,
    savedManually,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
}

async function saveReport(report) {
  const saved = await upsertDailyRuleReport(report);
  reportsCache = [saved, ...reportsCache.filter((item) => item.id !== saved.id)];
  return saved;
}

// --- Day rollover -----------------------------------------------------------

// Archives the previous tracked day and resets each enabled account's rule book
// for the new day. Best-effort and idempotent: a day already archived is not
// re-saved, and a manually-saved report is never overwritten.
async function processDayRollover() {
  const userId = getActiveUserId();

  if (!userId) {
    return;
  }

  const today = todayKey();

  for (const account of loadAccounts(userId)) {
    const ruleBook = account.ruleBook && typeof account.ruleBook === "object" ? account.ruleBook : null;

    if (!ruleBook || !ruleBook.enabled) {
      continue;
    }

    const lastTracked = typeof ruleBook.lastTrackedDate === "string" ? ruleBook.lastTrackedDate : "";

    // First time we see this account: just start tracking today.
    if (!lastTracked) {
      await persistTracking(userId, account.id, today, false);
      continue;
    }

    if (lastTracked >= today) {
      continue;
    }

    try {
      const reportId = `${account.id}:${lastTracked}`;
      const existing = reportsCache.find((report) => report.id === reportId);

      if (!existing || !existing.savedManually) {
        await saveReport(buildReport(userId, account.id, lastTracked, false));
      }

      // Reset the rule book for the new day (clear custom statuses, advance date).
      await persistTracking(userId, account.id, today, true);
    } catch (error) {
      console.error("Rule report rollover failed:", error.message);
    }
  }
}

// Persists the rule book's tracking date (and optionally resets custom statuses)
// while preserving every other rule-book field.
async function persistTracking(userId, accountId, date, resetCustomStatuses) {
  const { ruleBook } = evaluateAccountRules(userId, accountId, date);
  const nextRuleBook = {
    ...ruleBook,
    lastTrackedDate: date,
    customRules: resetCustomStatuses
      ? ruleBook.customRules.map((rule) => ({ ...rule, status: false }))
      : ruleBook.customRules,
  };

  await updateAccountRuleBook(userId, accountId, nextRuleBook);
}

function scheduleMidnightRollover() {
  if (midnightTimer) {
    window.clearTimeout(midnightTimer);
  }

  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const delay = Math.max(nextMidnight.getTime() - now.getTime(), 1000);

  midnightTimer = window.setTimeout(async () => {
    await processDayRollover();
    renderReports();
    scheduleMidnightRollover();
  }, delay);
}

// --- Rendering --------------------------------------------------------------

// Compact pill badge: PASS / FAILED / PENDING.
function resultBadge(result) {
  if (!result || result.passed === null || result.passed === undefined) {
    return '<span class="status-pill is-pending">Pending</span>';
  }

  return result.passed
    ? '<span class="status-pill is-pass">Pass</span>'
    : '<span class="status-pill is-fail">Failed</span>';
}

function scoreLabel(report) {
  if (!report.totalRules) {
    return "—";
  }

  return `${report.passedRules}/${report.totalRules} (${report.overallScorePercent}%)`;
}

function getCustomRules(report) {
  return Array.isArray(report.customRules) ? report.customRules : [];
}

function customRulesLabel(report) {
  const list = getCustomRules(report);

  if (list.length === 0) {
    return "No custom rules configured.";
  }

  const followed = list.filter((rule) => rule.status === true).length;
  return `${followed}/${list.length} followed`;
}

// Discipline label derived from the overall score percent. Returned as
// { tone, text } so the card can render an at-a-glance verdict.
function disciplineLabel(report) {
  const percent = report.overallScorePercent;

  if (percent === null || percent === undefined) {
    return null;
  }

  if (percent >= 90) {
    return { tone: "excellent", text: "Excellent" };
  }

  if (percent >= 70) {
    return { tone: "good", text: "Good" };
  }

  if (percent >= 50) {
    return { tone: "average", text: "Average" };
  }

  if (percent >= 30) {
    return { tone: "poor", text: "Poor" };
  }

  return { tone: "bad", text: "Bad" };
}

// Custom rules ordered violated-first, then followed. Stable within each group.
function orderedCustomRules(report) {
  const list = getCustomRules(report);
  const violated = list.filter((rule) => rule.status !== true);
  const followed = list.filter((rule) => rule.status === true);
  return [...violated, ...followed];
}

function customRulesExpansion(report) {
  const list = getCustomRules(report);

  if (list.length === 0) {
    return "";
  }

  const items = orderedCustomRules(report)
    .map((rule) => {
      const followed = rule.status === true;
      const mark = followed
        ? '<span class="positive">✓</span>'
        : '<span class="negative">✗</span>';
      const title = rule.description ? `title="${escapeHtml(rule.description)}"` : "";
      return `<li class="rule-report-custom-rule" ${title}>${mark} <span>${escapeHtml(rule.title)}</span></li>`;
    })
    .join("");

  return `<ul class="rule-report-custom-list">${items}</ul>`;
}

function formatReportDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function renderReports() {
  if (!ctx || !elements.ruleReportList) {
    return;
  }

  const reports = reportsCache
    .filter((report) => report.accountId === selectedAccountId)
    .filter((report) => !reportFilters.startDate || report.reportDate >= reportFilters.startDate)
    .filter((report) => !reportFilters.endDate || report.reportDate <= reportFilters.endDate)
    .sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));

  const rangeActive = Boolean(reportFilters.startDate || reportFilters.endDate);

  if (reports.length === 0) {
    elements.ruleReportList.innerHTML = rangeActive
      ? '<p class="empty-state">No rule reports match the selected filters.</p>'
      : '<p class="empty-state">No rule reports saved yet.</p>';
    return;
  }

  elements.ruleReportList.innerHTML = reports.map(renderReportCard).join("");
}

function renderReportCard(report) {
  const hasCustomRules = getCustomRules(report).length > 0;
  const isExpanded = expandedReports.has(report.id);
  const discipline = disciplineLabel(report);
  const fraction = report.totalRules ? `${report.passedRules}/${report.totalRules}` : "—";
  const disciplineMarkup = discipline
    ? `<span class="discipline-badge is-${discipline.tone}">${escapeHtml(discipline.text)} ${escapeHtml(fraction)}</span>`
    : `<span class="discipline-badge is-pending">${escapeHtml(fraction)}</span>`;

  // Custom Rules row: a "View Custom Rules" toggle when rules exist.
  const customRow = hasCustomRules
    ? `<button class="rule-report-custom-toggle" type="button" data-report-toggle="${escapeHtml(report.id)}"
        aria-expanded="${isExpanded ? "true" : "false"}">
        <span>${isExpanded ? "▼" : "▶"} View Custom Rules (${escapeHtml(customRulesLabel(report))})</span>
      </button>
      ${isExpanded ? customRulesExpansion(report) : ""}`
    : '<span class="rule-report-custom-empty">No custom rules configured.</span>';

  return `
    <article class="rule-report-card">
      <div class="rule-report-card-head">
        <div>
          <strong>${escapeHtml(formatReportDate(report.reportDate))}</strong>
          <span>${escapeHtml(report.accountName || "")}</span>
        </div>
        ${disciplineMarkup}
      </div>
      <div class="rule-report-statuses">
        <div class="rule-report-status"><span>Daily Risk</span>${resultBadge(report.dailyRisk)}</div>
        <div class="rule-report-status"><span>Risk Per Trade</span>${resultBadge(report.riskPerTrade)}</div>
        <div class="rule-report-status"><span>Trades Per Day</span>${resultBadge(report.tradesPerDay)}</div>
      </div>
      <div class="rule-report-custom-section">${customRow}</div>
    </article>
  `;
}

// Toggles a card's expand state (UI-only) and re-renders. Wired once via
// delegation in setupRuleReports.
function handleReportToggle(event) {
  const button = event.target.closest("[data-report-toggle]");

  if (!button) {
    return;
  }

  const reportId = button.dataset.reportToggle;

  if (expandedReports.has(reportId)) {
    expandedReports.delete(reportId);
  } else {
    expandedReports.add(reportId);
  }

  renderReports();
}

function populateAccountOptions(accounts) {
  const previous = elements.ruleReportAccount.value || selectedAccountId;
  elements.ruleReportAccount.innerHTML = accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");

  const stillExists = accounts.some((account) => account.id === previous);
  elements.ruleReportAccount.value = stillExists ? previous : accounts[0].id;
  selectedAccountId = elements.ruleReportAccount.value;
}

// --- Public API -------------------------------------------------------------

// Sync refresh: repopulate the account selector and re-render from the cache.
// Safe to call from renderJournal (no network).
export function refreshRuleReports() {
  if (!ctx) {
    return;
  }

  const accounts = loadAccounts(getActiveUserId());

  if (accounts.length === 0) {
    elements.ruleReportsEmpty.classList.remove("is-hidden");
    elements.ruleReportsBody.classList.add("is-hidden");
    selectedAccountId = "";
    return;
  }

  elements.ruleReportsEmpty.classList.add("is-hidden");
  elements.ruleReportsBody.classList.remove("is-hidden");
  populateAccountOptions(accounts);
  renderReports();
}

function openReportFilterModal() {
  elements.ruleReportAccount.value = selectedAccountId;
  elements.ruleReportFilterStart.value = reportFilters.startDate;
  elements.ruleReportFilterEnd.value = reportFilters.endDate;
  elements.ruleReportFilterModal.classList.remove("is-hidden");
  document.body.classList.add("is-modal-open");
}

function closeReportFilterModal() {
  elements.ruleReportFilterModal.classList.add("is-hidden");
  document.body.classList.remove("is-modal-open");
}

function applyReportFilterModal() {
  selectedAccountId = elements.ruleReportAccount.value;
  reportFilters.startDate = elements.ruleReportFilterStart.value;
  reportFilters.endDate = elements.ruleReportFilterEnd.value;
  closeReportFilterModal();
  renderReports();
}

function clearReportFilterModal() {
  reportFilters.startDate = "";
  reportFilters.endDate = "";
  elements.ruleReportFilterStart.value = "";
  elements.ruleReportFilterEnd.value = "";
  renderReports();
}

async function handleSaveReport() {
  const userId = getActiveUserId();

  if (!userId || !selectedAccountId) {
    return;
  }

  try {
    await saveReport(buildReport(userId, selectedAccountId, todayKey(), true));
    renderReports();
    showToast("Today's rule report saved.");
  } catch (error) {
    showToast("Could not save the rule report. Please try again.");
    console.error("Save rule report failed:", error.message);
  }
}

// One-time setup during journal page init. Fetches existing reports once, runs
// the day-rollover, schedules the midnight rollover, and renders. No-op if the
// markup is absent.
export async function setupRuleReports(context) {
  const ids = [
    "saveRuleReport",
    "ruleReportsEmpty",
    "ruleReportsBody",
    "ruleReportAccount",
    "ruleReportList",
    "ruleReportFilters",
    "ruleReportFilterModal",
    "closeRuleReportFilter",
    "ruleReportFilterStart",
    "ruleReportFilterEnd",
    "ruleReportFilterApply",
    "ruleReportFilterCancel",
    "ruleReportFilterClearBtn",
  ];

  ids.forEach((id) => {
    elements[id] = document.querySelector(`#${id}`);
  });

  if (!elements.saveRuleReport) {
    return;
  }

  ctx = context;

  elements.saveRuleReport.addEventListener("click", handleSaveReport);
  elements.ruleReportList.addEventListener("click", handleReportToggle);

  if (elements.ruleReportFilters) {
    elements.ruleReportFilters.addEventListener("click", openReportFilterModal);
    elements.closeRuleReportFilter.addEventListener("click", closeReportFilterModal);
    elements.ruleReportFilterCancel.addEventListener("click", closeReportFilterModal);
    elements.ruleReportFilterApply.addEventListener("click", applyReportFilterModal);
    elements.ruleReportFilterClearBtn.addEventListener("click", clearReportFilterModal);
    elements.ruleReportFilterModal.addEventListener("click", (event) => {
      if (event.target === elements.ruleReportFilterModal) {
        closeReportFilterModal();
      }
    });
  }

  try {
    reportsCache = await getDailyRuleReports();
    await processDayRollover();
  } catch (error) {
    console.error("Could not load rule reports:", error.message);
  }

  refreshRuleReports();
  scheduleMidnightRollover();
}
