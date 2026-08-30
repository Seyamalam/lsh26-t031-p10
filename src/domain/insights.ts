import type { DayReading } from "./types"

export type ConsumptionAnomaly = {
  date: string
  units: number
  expectedUnits: number
  deviationUnits: number
  score: number
  direction: "high" | "low"
  reason: string
}

export type AlertStatus = "ok" | "warning" | "critical"

export type ConsumptionAlerts = {
  budget: {
    status: AlertStatus
    usedPercent: number
    remainingPoisha: number
    reason: string
  }
  runOut: {
    status: AlertStatus
    daysRemaining: number | null
    reason: string
  }
}

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

export function detectConsumptionAnomalies(
  readings: DayReading[],
  options: { windowDays?: number; sensitivity?: number } = {}
): ConsumptionAnomaly[] {
  const windowDays = options.windowDays ?? 14
  const sensitivity = options.sensitivity ?? 2.5
  if (!Number.isInteger(windowDays) || windowDays < 7)
    throw new Error("Anomaly window must be at least 7 days.")
  if (!Number.isFinite(sensitivity) || sensitivity < 1)
    throw new Error("Anomaly score threshold must be at least 1.")

  const anomalies: ConsumptionAnomaly[] = []
  for (let index = windowDays; index < readings.length; index += 1) {
    const trailing = readings
      .slice(index - windowDays, index)
      .map((item) => item.units)
    const expectedUnits = average(trailing)
    const variance = average(
      trailing.map((units) => (units - expectedUnits) ** 2)
    )
    const observedSpread = Math.sqrt(variance)
    const effectiveSpread = Math.max(observedSpread, expectedUnits * 0.1, 0.5)
    const reading = readings[index]!
    const deviationUnits = reading.units - expectedUnits
    const score = Math.abs(deviationUnits) / effectiveSpread
    if (score < sensitivity) continue
    const direction = deviationUnits >= 0 ? "high" : "low"
    anomalies.push({
      date: reading.date,
      units: reading.units,
      expectedUnits: Number(expectedUnits.toFixed(2)),
      deviationUnits: Number(deviationUnits.toFixed(2)),
      score: Number(score.toFixed(2)),
      direction,
      reason: `${reading.units.toFixed(1)} units is ${Math.abs(deviationUnits).toFixed(1)} ${direction === "high" ? "above" : "below"} the ${windowDays}-day average of ${expectedUnits.toFixed(1)} and crosses the adaptive score threshold of ${sensitivity.toFixed(1)}.`,
    })
  }
  return anomalies
}

export function evaluateConsumptionAlerts(input: {
  currentMonthCostPoisha: number
  monthlyBudgetPoisha: number
  budgetWarningPercent: number
  runOutDays: number | null
  runOutWarningDays: number
}): ConsumptionAlerts {
  const {
    currentMonthCostPoisha,
    monthlyBudgetPoisha,
    budgetWarningPercent,
    runOutDays,
    runOutWarningDays,
  } = input
  if (!Number.isInteger(currentMonthCostPoisha) || currentMonthCostPoisha < 0)
    throw new Error("Current month cost must be non-negative poisha.")
  if (!Number.isInteger(monthlyBudgetPoisha) || monthlyBudgetPoisha <= 0)
    throw new Error("Monthly budget must be positive poisha.")
  if (budgetWarningPercent <= 0 || budgetWarningPercent > 100)
    throw new Error("Budget warning must be between 1 and 100 percent.")
  if (!Number.isInteger(runOutWarningDays) || runOutWarningDays < 1)
    throw new Error("Run-out warning must be at least one day.")

  const usedPercent = (currentMonthCostPoisha / monthlyBudgetPoisha) * 100
  const remainingPoisha = monthlyBudgetPoisha - currentMonthCostPoisha
  const budgetStatus: AlertStatus =
    remainingPoisha < 0
      ? "critical"
      : usedPercent >= budgetWarningPercent
        ? "warning"
        : "ok"
  const budgetReason =
    budgetStatus === "critical"
      ? `Monthly cost is ${usedPercent.toFixed(1)}% of budget and exceeds it by ${(Math.abs(remainingPoisha) / 100).toFixed(2)} BDT.`
      : `Monthly cost is ${usedPercent.toFixed(1)}% of budget against the ${budgetWarningPercent.toFixed(1)}% warning level; ${(remainingPoisha / 100).toFixed(2)} BDT remains.`

  const runOutStatus: AlertStatus =
    runOutDays === null
      ? "ok"
      : runOutDays <= 0
        ? "critical"
        : runOutDays <= runOutWarningDays
          ? "warning"
          : "ok"
  const runOutReason =
    runOutDays === null
      ? "No run-out date is projected at the current usage setting."
      : runOutDays <= 0
        ? "The reconstructed balance is already exhausted."
        : `Balance is projected to last ${runOutDays} days against the ${runOutWarningDays}-day warning window.`

  return {
    budget: {
      status: budgetStatus,
      usedPercent: Number(usedPercent.toFixed(2)),
      remainingPoisha,
      reason: budgetReason,
    },
    runOut: {
      status: runOutStatus,
      daysRemaining: runOutDays,
      reason: runOutReason,
    },
  }
}
