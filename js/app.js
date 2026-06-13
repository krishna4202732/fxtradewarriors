import {
  DEFAULT_STATE,
  INSTRUMENTS,
  PROP_FIRM_PRESETS,
  RISK_TYPE_OPTIONS,
  RISK_TYPES,
} from "./config.js";
import {
  calculateExitPnl,
  calculateFixedLotTrade,
  calculateTrade,
  clampPercent,
  formatCurrency,
  formatDistance,
  formatLot,
  formatPercent,
  formatPointValue,
  formatPrice,
  formatRatio,
} from "./calculator.js";
import { calculatePropFirmStatus } from "./propFirm.js";
import {
  clearAllHistory,
  deleteTrade,
  loadHistory,
  saveTrade,
} from "./history.js";
import { validateCalculationInput } from "./validation.js";
import {
  authenticateUser,
  getStoredUser,
  logoutUser,
} from "./auth.js";
import {
  addJournalEntry,
  createAccount,
  deleteAccount,
  deleteJournalEntry,
  loadAccounts,
  loadJournalEntries,
  recalculateUserJournal,
} from "./journal.js";

const THEME_STORAGE_KEY = "fxTradeWarriors.theme.v1";
const ADMIN_SAVE_PIN = "7243";

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
  ACTIVE: "🟡 ACTIVE",
  PASSED: "✅ PASSED",
  FAILED: "❌ FAILED",
};

const elements = {
  views: {
    landing: document.querySelector("#landingView"),
    auth: document.querySelector("#authView"),
    home: document.querySelector("#homeView"),
    calculator: document.querySelector("#calculatorView"),
    journal: document.querySelector("#journalView"),
  },
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  homeDisplayName: document.querySelector("#homeDisplayName"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  themeToggles: Array.from(document.querySelectorAll("[data-theme-toggle]")),
  stopDistance: document.querySelector("#stopDistance"),
  profitDistance: document.querySelector("#profitDistance"),
  riskPerLot: document.querySelector("#riskPerLot"),
  rewardPerLot: document.querySelector("#rewardPerLot"),
  form: document.querySelector("#calculatorForm"),
  accountBalance: document.querySelector("#accountBalance"),
  riskType: document.querySelector("#riskType"),
  riskValue: document.querySelector("#riskValue"),
  riskValueLabel: document.querySelector("#riskValueLabel"),
  riskValueSuffix: document.querySelector("#riskValueSuffix"),
  instrument: document.querySelector("#instrument"),
  entryPrice: document.querySelector("#entryPrice"),
  stopLoss: document.querySelector("#stopLoss"),
  takeProfit: document.querySelector("#takeProfit"),
  directionBadge: document.querySelector("#directionBadge"),
  errorPanel: document.querySelector("#errorPanel"),
  errorList: document.querySelector("#errorList"),
  lotSize: document.querySelector("#lotSize"),
  lotNote: document.querySelector("#lotNote"),
  riskAmount: document.querySelector("#riskAmount"),
  potentialProfit: document.querySelector("#potentialProfit"),
  potentialLoss: document.querySelector("#potentialLoss"),
  riskReward: document.querySelector("#riskReward"),
  pipValue: document.querySelector("#pipValue"),
  calcWarningPanel: document.querySelector("#calcWarningPanel"),
  calcWarningList: document.querySelector("#calcWarningList"),
  summaryInstrument: document.querySelector("#summaryInstrument"),
  summaryBalance: document.querySelector("#summaryBalance"),
  summaryRisk: document.querySelector("#summaryRisk"),
  summaryStopLoss: document.querySelector("#summaryStopLoss"),
  summaryTakeProfit: document.querySelector("#summaryTakeProfit"),
  summaryLotSize: document.querySelector("#summaryLotSize"),
  summaryProfit: document.querySelector("#summaryProfit"),
  summaryLoss: document.querySelector("#summaryLoss"),
  summaryRiskReward: document.querySelector("#summaryRiskReward"),
  summaryVisualProfit: document.querySelector("#summaryVisualProfit"),
  summaryVisualLoss: document.querySelector("#summaryVisualLoss"),
  summaryVisualRiskReward: document.querySelector("#summaryVisualRiskReward"),
  summaryProfitBar: document.querySelector("#summaryProfitBar"),
  summaryLossBar: document.querySelector("#summaryLossBar"),
  summaryRiskRewardBar: document.querySelector("#summaryRiskRewardBar"),
  copySummary: document.querySelector("#copySummary"),
  saveCalculation: document.querySelector("#saveCalculation"),
  propPreset: document.querySelector("#propPreset"),
  customLimits: document.querySelector("#customLimits"),
  currentDailyLoss: document.querySelector("#currentDailyLoss"),
  currentOverallDrawdown: document.querySelector("#currentOverallDrawdown"),
  customDailyPercent: document.querySelector("#customDailyPercent"),
  customMaxPercent: document.querySelector("#customMaxPercent"),
  dailyLimit: document.querySelector("#dailyLimit"),
  maxLimit: document.querySelector("#maxLimit"),
  dailyRemaining: document.querySelector("#dailyRemaining"),
  maxRemaining: document.querySelector("#maxRemaining"),
  riskUsage: document.querySelector("#riskUsage"),
  dailyProgress: document.querySelector("#dailyProgress"),
  maxProgress: document.querySelector("#maxProgress"),
  riskUsageProgress: document.querySelector("#riskUsageProgress"),
  propWarningPanel: document.querySelector("#propWarningPanel"),
  propWarningList: document.querySelector("#propWarningList"),
  toggleHistory: document.querySelector("#toggleHistory"),
  clearHistory: document.querySelector("#clearHistory"),
  historyPanelBody: document.querySelector("#historyPanelBody"),
  historyEmpty: document.querySelector("#historyEmpty"),
  historyList: document.querySelector("#historyList"),
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
  journalMarket: document.querySelector("#journalMarket"),
  journalEntryPrice: document.querySelector("#journalEntryPrice"),
  journalStopLoss: document.querySelector("#journalStopLoss"),
  journalTakeProfit: document.querySelector("#journalTakeProfit"),
  journalLotSize: document.querySelector("#journalLotSize"),
  journalEntryTime: document.querySelector("#journalEntryTime"),
  journalOutcome: document.querySelector("#journalOutcome"),
  journalExitPriceField: document.querySelector("#journalExitPriceField"),
  journalExitPrice: document.querySelector("#journalExitPrice"),
  journalPotentialProfit: document.querySelector("#journalPotentialProfit"),
  journalPotentialLoss: document.querySelector("#journalPotentialLoss"),
  journalRiskReward: document.querySelector("#journalRiskReward"),
  journalFinalPnl: document.querySelector("#journalFinalPnl"),
  journalBalanceAfter: document.querySelector("#journalBalanceAfter"),
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
  journalEmpty: document.querySelector("#journalEmpty"),
  journalList: document.querySelector("#journalList"),
  journalDetailPanel: document.querySelector("#journalDetailPanel"),
  journalDetailContent: document.querySelector("#journalDetailContent"),
  closeJournalDetail: document.querySelector("#closeJournalDetail"),
  accountDeleteDialog: document.querySelector("#accountDeleteDialog"),
  cancelDeleteAccount: document.querySelector("#cancelDeleteAccount"),
  confirmDeleteAccount: document.querySelector("#confirmDeleteAccount"),
  toast: document.querySelector("#toast"),
};

let activeUser = null;
let currentCalculation = null;
let currentJournalPreview = null;
let historyVisible = false;
let toastTimer = null;
let pendingDeleteAccountId = "";
const expandedPropDashboards = new Set();

function getActiveUserId() {
  return activeUser ? activeUser.username : "";
}

function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  const isLight = normalizedTheme === "light";

  document.documentElement.dataset.theme = normalizedTheme;

  elements.themeToggles.forEach((toggle) => {
    const text = toggle.querySelector(".theme-toggle-text");

    if (text) {
      text.textContent = isLight ? "Light" : "Dark";
    }

    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  });

  if (elements.themeColor) {
    elements.themeColor.setAttribute("content", isLight ? "#F8FAFC" : "#0A0E17");
  }
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";

  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  showToast(`${nextTheme === "light" ? "Light" : "Dark"} mode active.`);
}

function showView(viewName) {
  const publicViews = ["landing", "auth"];
  const nextView = activeUser || publicViews.includes(viewName) ? viewName : "landing";

  Object.entries(elements.views).forEach(([name, element]) => {
    element.classList.toggle("is-hidden", name !== nextView);
  });

  if (nextView === "auth") {
    elements.loginUsername.focus();
  }

  if (nextView === "home") {
    renderHome();
  }

  if (nextView === "calculator") {
    updateApp();
    renderHistory();
  }

  if (nextView === "journal") {
    renderJournal();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleLoginSubmit(event) {
  event.preventDefault();

  const user = authenticateUser(elements.loginUsername.value, elements.loginPassword.value);

  if (!user) {
    elements.loginError.textContent = "Invalid username or password.";
    elements.loginPassword.select();
    return;
  }

  activeUser = user;
  recalculateUserJournal(getActiveUserId());
  elements.loginError.textContent = "";
  elements.loginForm.reset();
  showView("home");
  showToast(`Welcome, ${user.displayName}.`);
}

function handleLogout() {
  logoutUser();
  activeUser = null;
  currentCalculation = null;
  currentJournalPreview = null;
  elements.loginForm.reset();
  hideJournalDetail();
  showView("landing");
  showToast("Logged out.");
}

function renderHome() {
  setText(elements.homeDisplayName, activeUser ? activeUser.displayName : "Trader");
}

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value || "--";
}

function setBarFill(element, percent) {
  if (!element) {
    return;
  }

  const normalizedPercent = clampPercent(percent);
  element.style.setProperty("--bar-width", `${normalizedPercent}%`);
}

function setSignedClass(element, value) {
  if (!element) {
    return;
  }

  element.classList.remove("positive", "negative");

  if (!Number.isFinite(value) || value === 0) {
    return;
  }

  element.classList.add(value > 0 ? "positive" : "negative");
}

function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }

  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }

  return formatCurrency(0);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved trade";
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSummaryVisuals(calculation) {
  if (!calculation) {
    setText(elements.summaryVisualProfit, "--");
    setText(elements.summaryVisualLoss, "--");
    setText(elements.summaryVisualRiskReward, "--");
    setBarFill(elements.summaryProfitBar, 0);
    setBarFill(elements.summaryLossBar, 0);
    setBarFill(elements.summaryRiskRewardBar, 0);
    return;
  }

  const potentialProfit = Math.max(calculation.potentialProfit, 0);
  const potentialLoss = Math.max(calculation.potentialLoss, 0);
  const largestMoneyValue = Math.max(potentialProfit, potentialLoss, 1);
  const ratioScale = Math.max(calculation.riskRewardRatio, 1);

  setText(elements.summaryVisualProfit, formatCurrency(potentialProfit));
  setText(elements.summaryVisualLoss, formatCurrency(potentialLoss));
  setText(elements.summaryVisualRiskReward, formatRatio(calculation.riskRewardRatio));
  setBarFill(elements.summaryProfitBar, (potentialProfit / largestMoneyValue) * 100);
  setBarFill(elements.summaryLossBar, (potentialLoss / largestMoneyValue) * 100);
  setBarFill(elements.summaryRiskRewardBar, (calculation.riskRewardRatio / Math.max(ratioScale, 3)) * 100);
}

function populateSelects() {
  elements.riskType.innerHTML = RISK_TYPE_OPTIONS.map(
    (option) => `<option value="${option.value}">${option.label}</option>`,
  ).join("");

  const instrumentOptions = Object.values(INSTRUMENTS)
    .map((instrument) => `<option value="${instrument.symbol}">${instrument.displayName}</option>`)
    .join("");

  elements.instrument.innerHTML = instrumentOptions;
  elements.journalMarket.innerHTML = instrumentOptions;
  elements.propPreset.innerHTML = Object.entries(PROP_FIRM_PRESETS)
    .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
    .join("");
}

function applyDefaultValues() {
  elements.accountBalance.value = DEFAULT_STATE.accountBalance;
  elements.riskType.value = DEFAULT_STATE.riskType;
  elements.riskValue.value = DEFAULT_STATE.riskValue;
  elements.instrument.value = DEFAULT_STATE.instrument;
  elements.entryPrice.value = DEFAULT_STATE.entryPrice;
  elements.stopLoss.value = DEFAULT_STATE.stopLoss;
  elements.takeProfit.value = DEFAULT_STATE.takeProfit;
  elements.propPreset.value = DEFAULT_STATE.propPreset;
  elements.currentDailyLoss.value = DEFAULT_STATE.currentDailyLoss;
  elements.currentOverallDrawdown.value = DEFAULT_STATE.currentOverallDrawdown;
  elements.customDailyPercent.value = DEFAULT_STATE.customDailyPercent;
  elements.customMaxPercent.value = DEFAULT_STATE.customMaxPercent;
  resetJournalForm();
}

function resetJournalForm() {
  elements.journalForm.reset();
  elements.journalMarket.value = DEFAULT_STATE.instrument;
  elements.journalEntryPrice.value = DEFAULT_STATE.entryPrice;
  elements.journalStopLoss.value = DEFAULT_STATE.stopLoss;
  elements.journalTakeProfit.value = DEFAULT_STATE.takeProfit;
  elements.journalLotSize.value = "0.01";
  elements.journalOutcome.value = "tp";
  elements.journalEntryTime.value = getLocalDateTimeValue();
  elements.journalExitPriceField.classList.add("is-hidden");
  elements.journalExitPrice.value = "";
  updateJournalPriceSteps();
}

function readCalculatorInput() {
  return {
    accountBalance: elements.accountBalance.value,
    riskType: elements.riskType.value,
    riskValue: elements.riskValue.value,
    instrument: elements.instrument.value,
    entryPrice: elements.entryPrice.value,
    stopLoss: elements.stopLoss.value,
    takeProfit: elements.takeProfit.value,
  };
}

function readPropInput(accountBalance, riskAmount) {
  return {
    accountBalance,
    riskAmount,
    propPreset: elements.propPreset.value,
    currentDailyLoss: elements.currentDailyLoss.value,
    currentOverallDrawdown: elements.currentOverallDrawdown.value,
    customDailyPercent: elements.customDailyPercent.value,
    customMaxPercent: elements.customMaxPercent.value,
  };
}

function writeNormalizedPriceValues(values) {
  if (!Array.isArray(values.priceCorrections) || values.priceCorrections.length === 0) {
    return;
  }

  const instrument = INSTRUMENTS[values.instrument];

  values.priceCorrections.forEach((correction) => {
    const element = elements[correction.field];

    if (element && instrument) {
      element.value = formatPrice(correction.to, instrument);
    }
  });
}

function updateRiskMeta() {
  const instrument =
    INSTRUMENTS[elements.instrument.value] || INSTRUMENTS.EURUSD;
  const isPointRisk = elements.riskType.value === RISK_TYPES.POINTS;
  const suffixMap = {
    [RISK_TYPES.PERCENT]: "%",
    [RISK_TYPES.FIXED]: "$",
    [RISK_TYPES.POINTS]: `${instrument.pointName}s`,
  };

  elements.riskValueSuffix.textContent =
    suffixMap[elements.riskType.value] || "";
  elements.riskValueLabel.textContent = isPointRisk
    ? "Pips / Points Risk"
    : "Risk Value";
  elements.riskValue.step = isPointRisk ? "0.1" : "0.01";

  const priceStep = instrument.pointSize.toFixed(instrument.priceDecimals);
  elements.entryPrice.step = priceStep;
  elements.stopLoss.step = priceStep;
  elements.takeProfit.step = priceStep;
}

function updateJournalPriceSteps() {
  const instrument = INSTRUMENTS[elements.journalMarket.value] || INSTRUMENTS.EURUSD;
  const priceStep = instrument.pointSize.toFixed(instrument.priceDecimals);

  elements.journalEntryPrice.step = priceStep;
  elements.journalStopLoss.step = priceStep;
  elements.journalTakeProfit.step = priceStep;
  elements.journalExitPrice.step = priceStep;
}

function renderErrors(errors) {
  elements.errorList.innerHTML = errors
    .map((error) => `<li>${escapeHtml(error)}</li>`)
    .join("");
  elements.errorPanel.classList.toggle("is-hidden", errors.length === 0);
}

function renderPanelErrors(panel, list, errors) {
  list.innerHTML = errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("");
  panel.classList.toggle("is-hidden", errors.length === 0);
}

function renderWarnings(panel, list, warnings) {
  list.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
  panel.classList.toggle("is-hidden", warnings.length === 0);
}

function renderDirection(calculation) {
  elements.directionBadge.classList.remove("is-long", "is-short");

  if (!calculation) {
    elements.directionBadge.textContent = "Waiting";
    return;
  }

  elements.directionBadge.textContent = calculation.direction;
  elements.directionBadge.classList.add(
    calculation.direction === "Long" ? "is-long" : "is-short",
  );
}

function renderEmptyCalculation() {
  currentCalculation = null;
  renderDirection(null);
  [
    elements.lotSize,
    elements.riskAmount,
    elements.potentialProfit,
    elements.potentialLoss,
    elements.riskReward,
    elements.pipValue,
    elements.summaryInstrument,
    elements.summaryBalance,
    elements.summaryRisk,
    elements.summaryStopLoss,
    elements.summaryTakeProfit,
    elements.summaryLotSize,
    elements.summaryProfit,
    elements.summaryLoss,
    elements.summaryRiskReward,
    elements.stopDistance,
    elements.profitDistance,
    elements.riskPerLot,
    elements.rewardPerLot,
  ].forEach((element) => setText(element, "--"));

  elements.lotNote.textContent = "standard lots";
  renderSummaryVisuals(null);
  elements.copySummary.disabled = true;
  elements.saveCalculation.disabled = true;
  renderWarnings(elements.calcWarningPanel, elements.calcWarningList, []);
}

function renderCalculation(calculation) {
  currentCalculation = calculation;
  renderDirection(calculation);
  setText(elements.lotSize, formatLot(calculation.lotSize));
  elements.lotNote.textContent = "standard lots";
  setText(elements.riskAmount, formatCurrency(calculation.targetRiskAmount));
  setText(elements.potentialProfit, formatCurrency(calculation.potentialProfit));
  setText(elements.potentialLoss, formatCurrency(calculation.potentialLoss));
  setText(elements.riskReward, formatRatio(calculation.riskRewardRatio));
  setText(
    elements.pipValue,
    formatPointValue(calculation.pointValue, calculation.instrument.pointName),
  );

  setText(
    elements.stopDistance,
    formatDistance(calculation.stopDistancePoints, calculation.instrument),
  );

  setText(
    elements.profitDistance,
    formatDistance(calculation.profitDistancePoints, calculation.instrument),
  );

  setText(
    elements.riskPerLot,
    `${(
      calculation.stopDistancePoints *
      calculation.instrument.valuePerPointPerLot
    ).toFixed(2)} USD`,
  );

  setText(
    elements.rewardPerLot,
    `${(
      calculation.profitDistancePoints *
      calculation.instrument.valuePerPointPerLot
    ).toFixed(2)} USD`,
  );
  setText(elements.summaryInstrument, calculation.instrument.displayName);
  setText(elements.summaryBalance, formatCurrency(calculation.accountBalance));
  setText(elements.summaryRisk, formatCurrency(calculation.targetRiskAmount));
  setText(
    elements.summaryStopLoss,
    formatPrice(calculation.stopLoss, calculation.instrument),
  );
  setText(
    elements.summaryTakeProfit,
    formatPrice(calculation.takeProfit, calculation.instrument),
  );
  setText(elements.summaryLotSize, formatLot(calculation.lotSize));
  setText(elements.summaryProfit, formatCurrency(calculation.potentialProfit));
  setText(elements.summaryLoss, formatCurrency(calculation.potentialLoss));
  setText(elements.summaryRiskReward, formatRatio(calculation.riskRewardRatio));
  renderSummaryVisuals(calculation);
  elements.copySummary.disabled = false;
  elements.saveCalculation.disabled = false;
  renderWarnings(
    elements.calcWarningPanel,
    elements.calcWarningList,
    calculation.warnings,
  );
}

function renderPropFirm(accountBalance, riskAmount) {
  const status = calculatePropFirmStatus(
    readPropInput(accountBalance, riskAmount),
  );
  elements.customLimits.classList.toggle(
    "is-hidden",
    elements.propPreset.value !== "custom",
  );
  setText(elements.dailyLimit, formatCurrency(status.dailyLimit));
  setText(elements.maxLimit, formatCurrency(status.maxLimit));
  setText(elements.dailyRemaining, formatCurrency(status.dailyRemaining));
  setText(elements.maxRemaining, formatCurrency(status.maxRemaining));
  setText(elements.riskUsage, formatPercent(status.riskUsagePercent));
  elements.dailyProgress.value = clampPercent(status.dailyUsagePercent);
  elements.maxProgress.value = clampPercent(status.maxUsagePercent);
  elements.riskUsageProgress.value = clampPercent(status.riskUsagePercent);
  renderWarnings(
    elements.propWarningPanel,
    elements.propWarningList,
    status.warnings,
  );
}

function updateApp() {
  updateRiskMeta();
  const validation = validateCalculationInput(readCalculatorInput());

  renderErrors(validation.errors);

  if (!validation.isValid) {
    renderEmptyCalculation();
    renderPropFirm(Number(validation.values.accountBalance) || 0, 0);
    return;
  }

  const calculation = calculateTrade(validation.values);
  writeNormalizedPriceValues(validation.values);
  renderCalculation(calculation);
  renderPropFirm(calculation.accountBalance, calculation.potentialLoss);
}

function buildSummaryText(calculation) {
  return [
    "FX Trade Warriors - Trade Summary",
    `Instrument: ${calculation.instrument.displayName}`,
    `Direction: ${calculation.direction}`,
    `Account Balance: ${formatCurrency(calculation.accountBalance)}`,
    `Risk Amount: ${formatCurrency(calculation.targetRiskAmount)}`,
    `Entry Price: ${formatPrice(calculation.entryPrice, calculation.instrument)}`,
    `Stop Loss: ${formatPrice(calculation.stopLoss, calculation.instrument)}`,
    `Take Profit: ${formatPrice(calculation.takeProfit, calculation.instrument)}`,
    `Lot Size: ${formatLot(calculation.lotSize)}`,
    `Potential Profit: ${formatCurrency(calculation.potentialProfit)}`,
    `Potential Loss: ${formatCurrency(calculation.potentialLoss)}`,
    `Risk Reward: ${formatRatio(calculation.riskRewardRatio)}`,
  ].join("\n");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function setupScrollReveal() {
  const revealTargets = Array.from(
    document.querySelectorAll("[data-reveal], .app-header, .page-view .panel, .stats-grid > div"),
  );

  if (revealTargets.length === 0) {
    return;
  }

  revealTargets.forEach((target, index) => {
    target.classList.add("reveal-ready");
    target.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
  });

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    revealTargets.forEach((target) => target.classList.add("is-revealed"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.14,
    },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
}

async function copySummary() {
  if (!currentCalculation) {
    return;
  }

  const summary = buildSummaryText(currentCalculation);

  try {
    await navigator.clipboard.writeText(summary);
    showToast("Trade summary copied.");
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = summary;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Trade summary copied.");
  }
}

function renderHistory() {
  const history = loadHistory(getActiveUserId());
  elements.historyEmpty.classList.toggle("is-hidden", history.length > 0);
  elements.clearHistory.disabled = history.length === 0;
  elements.historyList.innerHTML = history.map(createHistoryRow).join("");
}

function createHistoryRow(trade) {
  const instrument = INSTRUMENTS[trade.instrument] || INSTRUMENTS.EURUSD;
  const formattedDate = formatDateTime(trade.date);
  const safeId = escapeHtml(trade.id);

  return `
    <article class="history-row" data-id="${safeId}">
      <div>
        <strong>${instrument.displayName}</strong>
        <span>${escapeHtml(formattedDate)}</span>
      </div>
      <div>
        <strong>${formatLot(trade.lotSize)}</strong>
        <span>Lot size</span>
      </div>
      <div>
        <strong>${formatCurrency(trade.riskAmount)}</strong>
        <span>Risk</span>
      </div>
      <div>
        <strong>${formatPrice(trade.stopLoss, instrument)}</strong>
        <span>Stop loss</span>
      </div>
      <div>
        <strong>${formatPrice(trade.takeProfit, instrument)}</strong>
        <span>Take profit</span>
      </div>
      <div class="history-actions">
        <button class="button secondary" type="button" data-action="recalculate" data-id="${safeId}">Recalculate</button>
        <button class="button danger" type="button" data-action="delete" data-id="${safeId}">Delete</button>
      </div>
    </article>
  `;
}

function saveCurrentCalculation() {
  if (!currentCalculation || !activeUser) {
    return;
  }

  const pin = window.prompt("Admin PIN required to save calculation. Only for admins.");

  if (pin !== ADMIN_SAVE_PIN) {
    showToast("Admin PIN incorrect. Calculation was not saved.");
    return;
  }

  saveTrade(getActiveUserId(), currentCalculation);
  renderHistory();
  showToast("Calculation saved.");
}

function recalculateTrade(tradeId) {
  const trade = loadHistory(getActiveUserId()).find((item) => item.id === tradeId);

  if (!trade) {
    return;
  }

  elements.accountBalance.value = trade.accountBalance;
  elements.riskType.value = trade.riskType;
  elements.riskValue.value = trade.riskValue;
  elements.instrument.value = trade.instrument;
  elements.entryPrice.value = trade.entryPrice;
  elements.stopLoss.value = trade.stopLoss;
  elements.takeProfit.value = trade.takeProfit;
  updateApp();
  showToast("Saved trade loaded.");
}

function handleHistoryAction(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const tradeId = button.dataset.id;

  if (button.dataset.action === "delete") {
    deleteTrade(getActiveUserId(), tradeId);
    renderHistory();
    showToast("Trade deleted.");
  }

  if (button.dataset.action === "recalculate") {
    recalculateTrade(tradeId);
  }
}

function toggleHistory() {
  historyVisible = !historyVisible;
  elements.historyPanelBody.classList.toggle("is-collapsed", !historyVisible);
  elements.toggleHistory.textContent = historyVisible
    ? "Hide History"
    : "View History";
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
  const clampedPercent = clampPercent(percent);

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
    entryTime: elements.journalEntryTime.value,
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

  if (!input.entryTime) {
    errors.push("Time of entry is required.");
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

  if (!calculation) {
    return {
      input,
      validation,
      calculation: null,
      finalTradePnL: null,
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

  return {
    input,
    validation,
    calculation,
    finalTradePnL,
    accountBalanceAfter:
      input.account && Number.isFinite(finalTradePnL)
        ? input.account.currentBalance + finalTradePnL
        : null,
  };
}

function renderJournalPreview(preview) {
  currentJournalPreview = preview;

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

function renderAccounts(accounts) {
  elements.journalAccountEmpty.classList.toggle("is-hidden", accounts.length > 0);

  if (accounts.length === 0) {
    elements.accountsList.innerHTML = '<p class="empty-state">No trading accounts yet.</p>';
    return;
  }

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

  return {
    totalTrades,
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
  setSignedClass(elements.statNetPnl, stats.netPnl);
  setSignedClass(elements.statBestTrade, stats.bestTrade);
  setSignedClass(elements.statWorstTrade, stats.worstTrade);
}

function renderJournalEntries(entries) {
  elements.journalEmpty.classList.toggle("is-hidden", entries.length > 0);

  if (entries.length === 0) {
    elements.journalList.innerHTML = "";
    return;
  }

  elements.journalList.innerHTML = entries
    .map((entry) => {
      const safeId = escapeHtml(entry.id);
      const finalPnl = Number(entry.finalTradePnL) || 0;

      return `
        <article class="journal-row" data-id="${safeId}">
          <div>
            <strong>${escapeHtml(formatDateTime(entry.entryTime || entry.createdAt))}</strong>
            <span>Date</span>
          </div>
          <div>
            <strong>${escapeHtml(entry.accountName)}</strong>
            <span>Account</span>
          </div>
          <div>
            <strong>${escapeHtml(entry.market)}</strong>
            <span>Market</span>
          </div>
          <div>
            <strong>${escapeHtml(OUTCOME_LABELS[entry.outcome] || entry.outcome)}</strong>
            <span>Outcome</span>
          </div>
          <div>
            <strong class="${finalPnl >= 0 ? "positive" : "negative"}">${formatSignedCurrency(finalPnl)}</strong>
            <span>Final PnL</span>
          </div>
          <div>
            <strong>${formatCurrency(entry.accountBalanceAfter)}</strong>
            <span>Balance After</span>
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

function renderJournal() {
  if (!activeUser) {
    return;
  }

  const { accounts, entries } = recalculateUserJournal(getActiveUserId());

  renderAccounts(accounts);
  renderJournalAccountOptions(accounts);
  renderStats(entries);
  renderJournalEntries(entries);
  renderPanelErrors(elements.accountErrorPanel, elements.accountErrorList, []);
  renderPanelErrors(elements.journalErrorPanel, elements.journalErrorList, []);
  updateJournalPreview();
}

function handleAccountSubmit(event) {
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

  createAccount(getActiveUserId(), {
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

function showAccountDeleteDialog(accountId) {
  pendingDeleteAccountId = accountId;
  elements.accountDeleteDialog.classList.remove("is-hidden");
  elements.confirmDeleteAccount.focus();
}

function hideAccountDeleteDialog() {
  pendingDeleteAccountId = "";
  elements.accountDeleteDialog.classList.add("is-hidden");
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

function confirmAccountDelete() {
  if (!pendingDeleteAccountId) {
    return;
  }

  deleteAccount(getActiveUserId(), pendingDeleteAccountId);
  expandedPropDashboards.delete(pendingDeleteAccountId);
  hideAccountDeleteDialog();
  hideJournalDetail();
  renderJournal();
  showToast("Account and linked journal entries deleted.");
}

function handleJournalSubmit(event) {
  event.preventDefault();

  const preview = updateJournalPreview({ showErrors: true });

  if (!preview.validation.isValid || !preview.calculation || !Number.isFinite(preview.finalTradePnL)) {
    return;
  }

  const { input, calculation } = preview;

  addJournalEntry(getActiveUserId(), {
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
    accountBalanceBefore: roundMoney(input.account.currentBalance),
    accountBalanceAfter: roundMoney(input.account.currentBalance + preview.finalTradePnL),
    entryLogic: input.entryLogic,
    exitLogic: input.exitLogic,
    mistakes: input.mistakes,
    lessonsLearned: input.lessonsLearned,
    notes: input.notes,
    entryTime: input.entryTime,
  });

  resetJournalForm();
  renderJournal();
  showToast("Journal entry saved.");
}

function hideJournalDetail() {
  elements.journalDetailPanel.classList.add("is-hidden");
  elements.journalDetailContent.innerHTML = "";
}

function renderJournalDetail(entry) {
  const instrument = INSTRUMENTS[entry.market] || INSTRUMENTS.EURUSD;
  const detailRows = [
    ["Date", formatDateTime(entry.entryTime || entry.createdAt)],
    ["Account", entry.accountName],
    ["Market", entry.market],
    ["Outcome", OUTCOME_LABELS[entry.outcome] || entry.outcome],
    ["Entry Price", formatPrice(entry.entryPrice, instrument)],
    ["Stop Loss", formatPrice(entry.stopLoss, instrument)],
    ["Take Profit", formatPrice(entry.takeProfit, instrument)],
    ["Exit Price", entry.exitPrice ? formatPrice(entry.exitPrice, instrument) : "--"],
    ["Lot Size", formatLot(entry.lotSize)],
    ["Potential Profit", formatSignedCurrency(Number(entry.potentialProfit) || 0)],
    ["Potential Loss", formatSignedCurrency(-(Number(entry.potentialLoss) || 0))],
    ["Risk Reward", formatRatio(Number(entry.riskReward) || 0)],
    ["Final Trade PnL", formatSignedCurrency(Number(entry.finalTradePnL) || 0)],
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

function handleJournalAction(event) {
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

    deleteJournalEntry(getActiveUserId(), entryId);
    hideJournalDetail();
    renderJournal();
    showToast("Journal entry deleted.");
  }
}

function handleGlobalNavigation(event) {
  const viewButton = event.target.closest("[data-view]");

  if (viewButton) {
    showView(viewButton.dataset.view);
    return;
  }

  if (event.target.closest("[data-logout]")) {
    handleLogout();
  }
}

function attachEvents() {
  const liveInputs = [
    elements.accountBalance,
    elements.riskType,
    elements.riskValue,
    elements.instrument,
    elements.entryPrice,
    elements.stopLoss,
    elements.takeProfit,
    elements.propPreset,
    elements.currentDailyLoss,
    elements.currentOverallDrawdown,
    elements.customDailyPercent,
    elements.customMaxPercent,
  ];

  liveInputs.forEach((element) => {
    element.addEventListener("input", updateApp);
    element.addEventListener("change", updateApp);
  });

  const journalLiveInputs = [
    elements.journalAccount,
    elements.journalMarket,
    elements.journalEntryPrice,
    elements.journalStopLoss,
    elements.journalTakeProfit,
    elements.journalLotSize,
    elements.journalEntryTime,
    elements.journalOutcome,
    elements.journalExitPrice,
  ];

  journalLiveInputs.forEach((element) => {
    element.addEventListener("input", () => updateJournalPreview());
    element.addEventListener("change", () => updateJournalPreview());
  });

  document.addEventListener("click", handleGlobalNavigation);
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.copySummary.addEventListener("click", copySummary);
  elements.saveCalculation.addEventListener("click", saveCurrentCalculation);
  elements.themeToggles.forEach((toggle) => {
    toggle.addEventListener("click", toggleTheme);
  });
  elements.toggleHistory.addEventListener("click", toggleHistory);
  elements.clearHistory.addEventListener("click", () => {
    clearAllHistory(getActiveUserId());
    renderHistory();
    showToast("History cleared.");
  });
  elements.historyList.addEventListener("click", handleHistoryAction);
  elements.accountForm.addEventListener("submit", handleAccountSubmit);
  elements.accountType.addEventListener("change", updateAccountPhaseVisibility);
  elements.accountsList.addEventListener("click", handleAccountAction);
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
}

function init() {
  applyTheme(getPreferredTheme());
  populateSelects();
  applyDefaultValues();
  updateAccountPhaseVisibility();
  attachEvents();
  activeUser = getStoredUser();
  if (activeUser) {
    recalculateUserJournal(getActiveUserId());
  }
  showView(activeUser ? "home" : "landing");
  setupScrollReveal();
}

init();
