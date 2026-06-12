import { HIGH_RISK_RULES, PROP_FIRM_PRESETS } from "./config.js";

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPreset(input) {
  const fallback = PROP_FIRM_PRESETS.custom;
  const selected = PROP_FIRM_PRESETS[input.propPreset] || fallback;

  if (!selected.isCustom) {
    return selected;
  }

  return {
    ...selected,
    dailyDrawdownPercent:
      numberOrZero(input.customDailyPercent) || fallback.dailyDrawdownPercent,
    maxDrawdownPercent:
      numberOrZero(input.customMaxPercent) || fallback.maxDrawdownPercent,
  };
}

export function calculatePropFirmStatus(input) {
  const preset = getPreset(input);
  const accountBalance = numberOrZero(input.accountBalance);
  const riskAmount = numberOrZero(input.riskAmount);
  const dailyLoss = numberOrZero(input.currentDailyLoss);
  const overallDrawdown = numberOrZero(input.currentOverallDrawdown);
  const dailyLimit = accountBalance * (preset.dailyDrawdownPercent / 100);
  const maxLimit = accountBalance * (preset.maxDrawdownPercent / 100);
  const projectedDailyUsage = dailyLoss + riskAmount;
  const projectedOverallUsage = overallDrawdown + riskAmount;
  const dailyUsagePercent =
    dailyLimit > 0 ? (projectedDailyUsage / dailyLimit) * 100 : 0;
  const maxUsagePercent =
    maxLimit > 0 ? (projectedOverallUsage / maxLimit) * 100 : 0;
  const riskUsagePercent = dailyLimit > 0 ? (riskAmount / dailyLimit) * 100 : 0;
  const warnings = [];

  if (dailyLimit > 0 && projectedDailyUsage > dailyLimit) {
    warnings.push("Daily Limit Exceeded");
  }

  if (maxLimit > 0 && projectedOverallUsage > maxLimit) {
    warnings.push("Overall Limit Exceeded");
  }

  if (
    accountBalance > 0 &&
    (riskAmount > accountBalance * (HIGH_RISK_RULES.accountRiskPercent / 100) ||
      riskUsagePercent > HIGH_RISK_RULES.dailyLimitUsagePercent)
  ) {
    warnings.push("Trade Risk Too High");
  }

  return {
    preset,
    dailyLimit,
    maxLimit,
    dailyRemaining: Math.max(dailyLimit - projectedDailyUsage, 0),
    maxRemaining: Math.max(maxLimit - projectedOverallUsage, 0),
    dailyUsagePercent,
    maxUsagePercent,
    riskUsagePercent,
    warnings,
  };
}
