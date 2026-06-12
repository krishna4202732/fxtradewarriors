import { INSTRUMENTS, RISK_TYPES } from "./config.js";

const FIELD_LABELS = {
  accountBalance: "Account balance",
  riskValue: "Risk value",
  entryPrice: "Entry price",
  stopLoss: "Stop loss",
  takeProfit: "Take profit",
};

function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requirePositiveNumber(rawInput, fieldName, errors) {
  const parsed = parseNumber(rawInput[fieldName]);

  if (parsed === null) {
    errors.push(`${FIELD_LABELS[fieldName]} is required.`);
    return null;
  }

  if (parsed < 0) {
    errors.push(`${FIELD_LABELS[fieldName]} cannot be negative.`);
    return null;
  }

  if (parsed === 0) {
    errors.push(`${FIELD_LABELS[fieldName]} must be greater than 0.`);
    return null;
  }

  return parsed;
}

function normalizeEurusdRelatedPrice(rawValue, price, entryPrice, instrument) {
  if (
    !instrument ||
    instrument.symbol !== "EURUSD" ||
    !Number.isFinite(price) ||
    !Number.isFinite(entryPrice)
  ) {
    return null;
  }

  const rawText = String(rawValue).trim();
  const rawParts = rawText.match(/^(\d+)\.(\d+)$/);

  if (!rawParts) {
    return null;
  }

  const [, wholePart, decimalPart] = rawParts;
  const entryWholePart = String(Math.trunc(entryPrice));
  const entryDecimalPart = String(entryPrice).split(".")[1] || "";
  const rawDistancePoints = Math.abs(price - entryPrice) / instrument.pointSize;

  if (
    wholePart !== entryWholePart ||
    decimalPart.length !== instrument.priceDecimals - 1 ||
    decimalPart.startsWith(entryDecimalPart[0] || "") ||
    rawDistancePoints < 1000
  ) {
    return null;
  }

  const repairedPrice = Number(`${entryWholePart}.${entryDecimalPart[0]}${decimalPart}`);
  const repairedDistancePoints = Math.abs(repairedPrice - entryPrice) / instrument.pointSize;

  if (!Number.isFinite(repairedPrice) || repairedDistancePoints >= rawDistancePoints) {
    return null;
  }

  return repairedPrice;
}

function isPlausibleEurusdPrice(value) {
  return Number.isFinite(value) && value > 0.5 && value < 2;
}

function inferTradeDirection(values, instrument) {
  if (!instrument || instrument.symbol !== "EURUSD" || !Number.isFinite(values.entryPrice)) {
    return null;
  }

  if (isPlausibleEurusdPrice(values.stopLoss) && values.stopLoss !== values.entryPrice) {
    return values.stopLoss < values.entryPrice ? "long" : "short";
  }

  if (isPlausibleEurusdPrice(values.takeProfit) && values.takeProfit !== values.entryPrice) {
    return values.takeProfit > values.entryPrice ? "long" : "short";
  }

  return null;
}

function normalizeEurusdDistance(rawValue, fieldName, entryPrice, instrument, direction) {
  if (
    !instrument ||
    instrument.symbol !== "EURUSD" ||
    !direction ||
    !Number.isFinite(entryPrice)
  ) {
    return null;
  }

  const rawText = String(rawValue).trim();

  if (!/^\d+(\.\d+)?$/.test(rawText)) {
    return null;
  }

  const parsed = Number(rawText);

  if (!Number.isFinite(parsed) || parsed < 2) {
    return null;
  }

  const distancePips = rawText.includes(".") ? parsed : parsed >= 100 ? parsed / 10 : parsed;
  const directionSign =
    fieldName === "stopLoss"
      ? (direction === "long" ? -1 : 1)
      : (direction === "long" ? 1 : -1);
  const normalizedPrice = entryPrice + directionSign * distancePips * instrument.pointSize;

  return Number(normalizedPrice.toFixed(instrument.priceDecimals));
}

function normalizeRelatedPrices(rawInput, values, instrument) {
  const corrections = [];

  if (!instrument || !Number.isFinite(values.entryPrice)) {
    return corrections;
  }

  ["stopLoss", "takeProfit"].forEach((fieldName) => {
    const normalizedPrice = normalizeEurusdRelatedPrice(
      rawInput[fieldName],
      values[fieldName],
      values.entryPrice,
      instrument,
    );

    if (normalizedPrice === null) {
      return;
    }

    corrections.push({
      field: fieldName,
      from: values[fieldName],
      rawInput: rawInput[fieldName],
      to: normalizedPrice,
    });
    values[fieldName] = normalizedPrice;
  });

  const direction = inferTradeDirection(values, instrument);

  ["stopLoss", "takeProfit"].forEach((fieldName) => {
    const normalizedPrice = normalizeEurusdDistance(
      rawInput[fieldName],
      fieldName,
      values.entryPrice,
      instrument,
      direction,
    );

    if (normalizedPrice === null || normalizedPrice === values[fieldName]) {
      return;
    }

    corrections.push({
      field: fieldName,
      from: values[fieldName],
      rawInput: rawInput[fieldName],
      to: normalizedPrice,
    });
    values[fieldName] = normalizedPrice;
  });

  return corrections;
}

export function parseOptionalLoss(value) {
  const parsed = parseNumber(value);

  if (parsed === null || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function validateCalculationInput(rawInput) {
  const errors = [];
  const instrument = INSTRUMENTS[rawInput.instrument];

  if (!instrument) {
    errors.push("Choose a supported instrument.");
  }

  if (!Object.values(RISK_TYPES).includes(rawInput.riskType)) {
    errors.push("Choose a valid risk type.");
  }

  const values = {
    accountBalance: requirePositiveNumber(rawInput, "accountBalance", errors),
    riskType: rawInput.riskType,
    riskValue: requirePositiveNumber(rawInput, "riskValue", errors),
    instrument: rawInput.instrument,
    entryPrice: requirePositiveNumber(rawInput, "entryPrice", errors),
    stopLoss: requirePositiveNumber(rawInput, "stopLoss", errors),
    takeProfit: requirePositiveNumber(rawInput, "takeProfit", errors),
  };
  values.priceCorrections = normalizeRelatedPrices(rawInput, values, instrument);

  if (values.entryPrice !== null && values.stopLoss !== null && values.entryPrice === values.stopLoss) {
    errors.push("Entry price and stop loss cannot be the same.");
  }

  if (values.entryPrice !== null && values.stopLoss !== null && values.takeProfit !== null) {
    const isLong = values.stopLoss < values.entryPrice;
    const takeProfitOnRightSide = isLong ? values.takeProfit > values.entryPrice : values.takeProfit < values.entryPrice;

    if (!takeProfitOnRightSide) {
      errors.push("Take profit must be on the opposite side of entry from stop loss.");
    }
  }

  if (values.accountBalance !== null && values.riskValue !== null && instrument) {
    const targetRiskAmount = getTargetRiskAmount(values, instrument);

    if (targetRiskAmount > values.accountBalance) {
      errors.push("Risk cannot be greater than account balance.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    values,
  };
}

export function getTargetRiskAmount(values, instrument) {
  if (!Number.isFinite(values.accountBalance) || !Number.isFinite(values.riskValue)) {
    return 0;
  }

  if (values.riskType === RISK_TYPES.PERCENT) {
    return values.accountBalance * (values.riskValue / 100);
  }

  if (values.riskType === RISK_TYPES.FIXED) {
    return values.riskValue;
  }

  if (values.riskType === RISK_TYPES.POINTS && instrument) {
    return values.riskValue * instrument.valuePerPointPerLot;
  }

  return 0;
}
