import { INSTRUMENTS, RISK_TYPES } from "./config.js";
import { getTargetRiskAmount } from "./validation.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function isUsableNumber(value) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function safeNumber(value, fallback = 0) {
  return isUsableNumber(value) ? value : fallback;
}

function roundToDecimals(value, decimals) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function roundLotDown(rawLotSize, instrument) {
  if (!isUsableNumber(rawLotSize) || rawLotSize <= 0) {
    return 0;
  }

  const steppedLot = Math.floor((rawLotSize + Number.EPSILON) / instrument.lotStep) * instrument.lotStep;
  const boundedLot = Math.min(Math.max(steppedLot, instrument.minLot), instrument.maxLot);
  return roundToDecimals(boundedLot, instrument.lotDecimals);
}

export function calculateTrade(input) {
  const instrument = INSTRUMENTS[input.instrument];

  if (!instrument) {
    return null;
  }

  const stopDistancePoints = Math.abs(input.entryPrice - input.stopLoss) / instrument.pointSize;
  const profitDistancePoints = Math.abs(input.takeProfit - input.entryPrice) / instrument.pointSize;
  const targetRiskAmount = getTargetRiskAmount(input, instrument);
  const riskPerLotAtStop = stopDistancePoints * instrument.valuePerPointPerLot;
  const rawLotSize = riskPerLotAtStop > 0 ? targetRiskAmount / riskPerLotAtStop : 0;
  const lotSize = roundLotDown(rawLotSize, instrument);
  const pointValue = lotSize * instrument.valuePerPointPerLot;
  const potentialLoss = stopDistancePoints * pointValue;
  const potentialProfit = profitDistancePoints * pointValue;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;
  const warnings = [];

  // Broker lot increments can make the displayed lot slightly different from the raw risk target.
  if (rawLotSize > 0 && rawLotSize < instrument.minLot) {
    warnings.push(`Recommended size is below the ${formatLot(instrument.minLot)} minimum lot for ${instrument.displayName}.`);
  }

  if (rawLotSize > instrument.maxLot) {
    warnings.push(`Recommended size was capped at ${formatLot(instrument.maxLot)} lots.`);
  }

  if (input.riskType === RISK_TYPES.POINTS) {
    warnings.push(`${instrument.pointName[0].toUpperCase()}${instrument.pointName.slice(1)} risk mode treats Risk Value as one-standard-lot ${instrument.pointName} exposure.`);
  }

  if (Array.isArray(input.priceCorrections)) {
    input.priceCorrections.forEach((correction) => {
      const label = correction.field === "takeProfit" ? "Take profit" : "Stop loss";
      const originalValue = correction.rawInput ?? formatPrice(correction.from, instrument);
      warnings.push(`${label} was normalized from ${originalValue} to ${formatPrice(correction.to, instrument)}.`);
    });
  }

  return {
    instrument,
    direction: input.stopLoss < input.entryPrice ? "Long" : "Short",
    accountBalance: input.accountBalance,
    riskType: input.riskType,
    riskValue: input.riskValue,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    priceCorrections: input.priceCorrections || [],
    stopDistancePoints,
    profitDistancePoints,
    targetRiskAmount,
    rawLotSize,
    lotSize,
    pointValue,
    potentialProfit,
    potentialLoss,
    riskRewardRatio,
    warnings,
  };
}

export function calculateFixedLotTrade(input) {
  const instrument = INSTRUMENTS[input.instrument];

  if (
    !instrument ||
    !isUsableNumber(input.entryPrice) ||
    !isUsableNumber(input.stopLoss) ||
    !isUsableNumber(input.takeProfit) ||
    !isUsableNumber(input.lotSize) ||
    input.lotSize <= 0
  ) {
    return null;
  }

  const stopDistancePoints = Math.abs(input.entryPrice - input.stopLoss) / instrument.pointSize;
  const profitDistancePoints = Math.abs(input.takeProfit - input.entryPrice) / instrument.pointSize;
  const pointValue = input.lotSize * instrument.valuePerPointPerLot;
  const potentialLoss = stopDistancePoints * pointValue;
  const potentialProfit = profitDistancePoints * pointValue;
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  return {
    instrument,
    direction: input.stopLoss < input.entryPrice ? "Long" : "Short",
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    lotSize: input.lotSize,
    stopDistancePoints,
    profitDistancePoints,
    pointValue,
    potentialProfit,
    potentialLoss,
    riskRewardRatio,
  };
}

export function calculateExitPnl(input) {
  const instrument = INSTRUMENTS[input.instrument];

  if (
    !instrument ||
    !isUsableNumber(input.entryPrice) ||
    !isUsableNumber(input.stopLoss) ||
    !isUsableNumber(input.exitPrice) ||
    !isUsableNumber(input.lotSize) ||
    input.lotSize <= 0
  ) {
    return 0;
  }

  const isLong = input.stopLoss < input.entryPrice;
  const signedDistancePoints = isLong
    ? (input.exitPrice - input.entryPrice) / instrument.pointSize
    : (input.entryPrice - input.exitPrice) / instrument.pointSize;

  return signedDistancePoints * input.lotSize * instrument.valuePerPointPerLot;
}

export function formatCurrency(value) {
  return isUsableNumber(value) ? currencyFormatter.format(value) : "--";
}

export function formatPercent(value) {
  return isUsableNumber(value) ? `${percentFormatter.format(value)}%` : "--";
}

export function formatLot(value) {
  return isUsableNumber(value) ? safeNumber(value).toFixed(2) : "--";
}

export function formatRatio(value) {
  return isUsableNumber(value) ? `1:${safeNumber(value).toFixed(2)}` : "--";
}

export function formatPrice(value, instrument) {
  if (!isUsableNumber(value) || !instrument) {
    return "--";
  }

  return safeNumber(value).toFixed(instrument.priceDecimals);
}

export function formatPointValue(value, pointName) {
  if (!isUsableNumber(value)) {
    return "--";
  }

  return `${currencyFormatter.format(value)} / ${pointName}`;
}

export function formatDistance(value, instrument) {
  if (!isUsableNumber(value) || !instrument) {
    return "--";
  }

  if (instrument.pointName === "pip") {
    const smallestPriceStep = 10 ** -instrument.priceDecimals;
    const brokerPoints = (value * instrument.pointSize) / smallestPriceStep;
    return `${safeNumber(value).toFixed(1)} pips / ${safeNumber(brokerPoints).toFixed(0)} points`;
  }

  return `${safeNumber(value).toFixed(1)} points`;
}

export function clampPercent(value) {
  if (!isUsableNumber(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}
