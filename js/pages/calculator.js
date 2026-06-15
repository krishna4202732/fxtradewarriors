// Calculator page controller. Carries the lot-size calculator, prop-firm
// drawdown monitor, and saved-calculation history logic from the original SPA
// app.js — unchanged behaviour, now scoped to its own page. Private page.

import {
  DEFAULT_STATE,
  INSTRUMENTS,
  PROP_FIRM_PRESETS,
  RISK_TYPE_OPTIONS,
  RISK_TYPES,
} from "../config.js";
import {
  calculateTrade,
  clampPercent,
  formatCurrency,
  formatDistance,
  formatLot,
  formatPercent,
  formatPointValue,
  formatPrice,
  formatRatio,
} from "../calculator.js";
import { calculatePropFirmStatus } from "../propFirm.js";
import {
  clearAllHistory,
  deleteTrade,
  loadHistory,
  saveTrade,
} from "../history.js";
import { validateCalculationInput } from "../validation.js";
import { initTheme } from "../theme.js";
import {
  escapeHtml,
  setBarFill,
  setText,
  setupScrollReveal,
  showToast,
} from "../dom-utils.js";
import { formatDateTime } from "../dom-utils.js";
import { requireAuth, initLogout } from "../router.js";
import { mountSharedComponents } from "../components.js";

const ADMIN_SAVE_PIN = "7243";

const elements = {
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
};

let activeUser = null;
let currentCalculation = null;
let historyVisible = false;

function getActiveUserId() {
  return activeUser ? activeUser.username : "";
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

function renderErrors(errors) {
  elements.errorList.innerHTML = errors
    .map((error) => `<li>${escapeHtml(error)}</li>`)
    .join("");
  elements.errorPanel.classList.toggle("is-hidden", errors.length === 0);
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

  elements.copySummary.addEventListener("click", copySummary);
  elements.saveCalculation.addEventListener("click", saveCurrentCalculation);
  elements.toggleHistory.addEventListener("click", toggleHistory);
  elements.clearHistory.addEventListener("click", () => {
    clearAllHistory(getActiveUserId());
    renderHistory();
    showToast("History cleared.");
  });
  elements.historyList.addEventListener("click", handleHistoryAction);
}

function init() {
  activeUser = requireAuth();

  if (!activeUser) {
    return;
  }

  mountSharedComponents();
  initTheme();
  initLogout();
  populateSelects();
  applyDefaultValues();
  attachEvents();
  updateApp();
  renderHistory();
  setupScrollReveal();
}

init();
