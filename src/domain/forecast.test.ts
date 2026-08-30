import { describe, expect, it } from "vitest"

import { evaluateForecastModels, forecastConsumption } from "./forecast"
import { addDays } from "./dates"
import type { DayReading } from "./types"

function seasonalReadings(length: number): DayReading[] {
  const weekdayEffect = [2.4, -1.1, 0.4, 1.6, -0.8, 3.2, 4.1]
  return Array.from({ length }, (_, index) => ({
    date: addDays("2026-01-01", index),
    units: Number((9 + index * 0.035 + weekdayEffect[index % 7]).toFixed(3)),
  }))
}

describe("forecast model evaluation", () => {
  it("backtests a 30-day holdout and selects the lower-error model", () => {
    const result = evaluateForecastModels(seasonalReadings(150), 30)

    expect(result.holdoutDays).toBe(30)
    expect(result.trainingDays).toBe(120)
    expect(result.regression.mae).toBeGreaterThanOrEqual(0)
    expect(result.regression.rmse).toBeGreaterThanOrEqual(result.regression.mae)
    expect(result.baseline.label).toBe("7-day mean")
    expect(result.regression.rmse).toBeLessThan(result.baseline.rmse)
    expect(result.selectedModel).toBe("regression")
    expect(result.reason).toContain("lower holdout RMSE")
  })

  it("produces a deterministic 30-day forecast with an RMSE uncertainty band", () => {
    const first = forecastConsumption(seasonalReadings(150), 30)
    const second = forecastConsumption(seasonalReadings(150), 30)

    expect(first).toEqual(second)
    expect(first.points).toHaveLength(30)
    expect(first.points[0]?.date).toBe("2026-05-31")
    for (const point of first.points) {
      expect(point.lowerUnits).toBeGreaterThanOrEqual(0)
      expect(point.lowerUnits).toBeLessThanOrEqual(point.predictedUnits)
      expect(point.upperUnits).toBeGreaterThanOrEqual(point.predictedUnits)
    }
    expect(first.explanation.features).toContain("day-of-week seasonality")
    expect(first.explanation.confidence).toContain("holdout RMSE")
  })
})
