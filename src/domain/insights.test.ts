import { describe, expect, it } from "vitest"

import {
  detectConsumptionAnomalies,
  evaluateConsumptionAlerts,
} from "./insights"
import { addDays } from "./dates"

describe("consumption anomalies", () => {
  it("explains a high reading against its trailing window", () => {
    const readings = Array.from({ length: 15 }, (_, index) => ({
      date: addDays("2026-01-01", index),
      units: index === 14 ? 30 : 10,
    }))

    const anomalies = detectConsumptionAnomalies(readings, {
      windowDays: 14,
      sensitivity: 2.5,
    })

    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      date: "2026-01-15",
      direction: "high",
      units: 30,
      expectedUnits: 10,
    })
    expect(anomalies[0]?.reason).toContain("30.0 units")
    expect(anomalies[0]?.reason).toContain("14-day average of 10.0")
    expect(anomalies[0]?.reason).toContain("2.5σ threshold")
  })
})

describe("budget and run-out alerts", () => {
  it("reports budget use and an approaching run-out with arithmetic in each reason", () => {
    const alerts = evaluateConsumptionAlerts({
      currentMonthCostPoisha: 9_000,
      monthlyBudgetPoisha: 10_000,
      budgetWarningPercent: 80,
      runOutDays: 4,
      runOutWarningDays: 7,
    })

    expect(alerts.budget).toMatchObject({
      status: "warning",
      usedPercent: 90,
      remainingPoisha: 1_000,
    })
    expect(alerts.budget.reason).toContain("90.0%")
    expect(alerts.budget.reason).toContain("80.0% warning level")
    expect(alerts.runOut).toMatchObject({ status: "warning", daysRemaining: 4 })
    expect(alerts.runOut.reason).toContain("4 days")
    expect(alerts.runOut.reason).toContain("7-day warning window")
  })

  it("marks an exceeded budget and exhausted balance as critical", () => {
    const alerts = evaluateConsumptionAlerts({
      currentMonthCostPoisha: 12_500,
      monthlyBudgetPoisha: 10_000,
      budgetWarningPercent: 80,
      runOutDays: 0,
      runOutWarningDays: 7,
    })

    expect(alerts.budget.status).toBe("critical")
    expect(alerts.budget.remainingPoisha).toBe(-2_500)
    expect(alerts.runOut.status).toBe("critical")
  })
})
