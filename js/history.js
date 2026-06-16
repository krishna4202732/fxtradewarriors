import { HISTORY_LIMIT } from "./config.js";
import * as db from "./database.js";
import { migrateLegacyData } from "./migrate.js";

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// In-memory cache hydrated from Supabase by initHistory() once per page load.
// loadHistory() reads it synchronously so the calculator's render path is
// unchanged; mutations persist to Supabase asynchronously.
const cache = new Map();

function readCache(userId) {
  const history = cache.get(userId);
  return Array.isArray(history) ? history : [];
}

function writeCache(userId, history) {
  const scopedHistory = history.slice(0, HISTORY_LIMIT);
  cache.set(userId, scopedHistory);
  return scopedHistory;
}

// Hydrate the cache from Supabase (running the one-time localStorage migration
// first, in case the calculator is the first page visited this session).
export async function initHistory(userId) {
  if (!userId) {
    return [];
  }

  await migrateLegacyData(userId);
  const history = await db.getCalculatorHistory();
  return writeCache(userId, history);
}

export function loadHistory(userId) {
  if (!userId) {
    return [];
  }

  return readCache(userId);
}

export async function saveTrade(userId, calculation) {
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

  const combined = [trade, ...loadHistory(userId)];
  const kept = writeCache(userId, combined);
  // Anything beyond the cap is dropped from the cache; remove it from Supabase too.
  const dropped = combined.slice(kept.length);

  await db.createCalculatorHistory(trade);
  for (const item of dropped) {
    await db.deleteCalculatorHistory(item.id);
  }

  return kept;
}

export async function deleteTrade(userId, id) {
  const history = loadHistory(userId).filter((trade) => trade.id !== id);
  writeCache(userId, history);
  await db.deleteCalculatorHistory(id);
  return history;
}

export async function clearAllHistory(userId) {
  writeCache(userId, []);
  await db.clearCalculatorHistory();
  return [];
}
