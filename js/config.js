export const STORAGE_KEY = "fxTradeWarriors.history.v1";
export const HISTORY_LIMIT = 50;

export const RISK_TYPES = {
  PERCENT: "percent",
  FIXED: "fixed",
  POINTS: "points",
};

export const RISK_TYPE_OPTIONS = [
  { value: RISK_TYPES.PERCENT, label: "Percentage Risk" },
  { value: RISK_TYPES.FIXED, label: "Fixed Dollar Risk" },
  { value: RISK_TYPES.POINTS, label: "Pips / Points Risk" },
];

export const INSTRUMENTS = {
  EURUSD: {
    symbol: "EURUSD",
    displayName: "EURUSD",
    pointName: "pip",
    pointSize: 0.0001,
    priceDecimals: 5,
    valuePerPointPerLot: 10,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100,
    lotDecimals: 2,
  },
  XAUUSD: {
    symbol: "XAUUSD",
    displayName: "XAUUSD",
    pointName: "point",
    pointSize: 0.01,
    priceDecimals: 2,
    valuePerPointPerLot: 1,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100,
    lotDecimals: 2,
  },
};

export const PROP_FIRM_PRESETS = {
  custom: {
    label: "Custom",
    dailyDrawdownPercent: 5,
    maxDrawdownPercent: 10,
    isCustom: true,
  },
  fundingPips: {
    label: "Funding Pips",
    dailyDrawdownPercent: 5,
    maxDrawdownPercent: 10,
  },
  ftmo: {
    label: "FTMO",
    dailyDrawdownPercent: 5,
    maxDrawdownPercent: 10,
  },
};

export const HIGH_RISK_RULES = {
  accountRiskPercent: 2,
  dailyLimitUsagePercent: 50,
};

export const DEFAULT_STATE = {
  accountBalance: 10000,
  riskType: RISK_TYPES.PERCENT,
  riskValue: 1,
  instrument: "EURUSD",
  entryPrice: 1.085,
  stopLoss: 1.08,
  takeProfit: 1.095,
  propPreset: "ftmo",
  currentDailyLoss: 0,
  currentOverallDrawdown: 0,
  customDailyPercent: 5,
  customMaxPercent: 10,
};
