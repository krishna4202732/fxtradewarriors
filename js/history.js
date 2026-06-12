import { HISTORY_LIMIT } from "./config.js";

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHistoryStorageKey(userId) {
  return `fx.user.${userId}.history`;
}

export function loadHistory(userId) {
  if (!userId) {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(getHistoryStorageKey(userId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeHistory(userId, history) {
  if (!userId) {
    return [];
  }

  const scopedHistory = history.slice(0, HISTORY_LIMIT);
  localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(scopedHistory));
  return scopedHistory;
}

export function saveTrade(userId, calculation) {
  const trade = {
    id: createId(),
    userId,
    date: new Date().toISOString(),
    instrument: calculation.instrument.symbol,
    accountBalance: calculation.accountBalance,
    riskType: calculation.riskType,
    riskValue: calculation.riskValue,
    entryPrice: calculation.entryPrice,
    stopLoss: calculation.stopLoss,
    takeProfit: calculation.takeProfit,
    lotSize: calculation.lotSize,
    riskAmount: calculation.targetRiskAmount,
    potentialProfit: calculation.potentialProfit,
    potentialLoss: calculation.potentialLoss,
    riskRewardRatio: calculation.riskRewardRatio,
  };

  const history = [trade, ...loadHistory(userId)].slice(0, HISTORY_LIMIT);
  writeHistory(userId, history);
  return history;
}

export function deleteTrade(userId, id) {
  const history = loadHistory(userId).filter((trade) => trade.id !== id);
  writeHistory(userId, history);
  return history;
}

export function clearAllHistory(userId) {
  return writeHistory(userId, []);
}
