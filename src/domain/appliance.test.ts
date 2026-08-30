import { describe, expect, it } from "vitest"

import { simulateAppliance } from "./appliance"

describe("appliance simulator", () => {
  it("calculates monthly units, slab energy, daily VAT, and fixed-charge evidence", () => {
    const result = simulateAppliance({
      startDate: "2026-01-01",
      days: 30,
      wattage: 1_000,
      hoursPerDay: 1,
      quantity: 1,
      baselineDailyUnits: 0,
      monthlyUnitsBefore: 0,
      includeFirstRechargeCharges: true,
    })

    expect(result.applianceMonthlyUnits).toBe(30)
    expect(result.incrementalEnergyPoisha).toBe(13_890)
    expect(result.incrementalVatPoisha).toBe(690)
    expect(result.fixedChargesPoisha).toBe(8_200)
    expect(result.totalPlanPoisha).toBe(22_780)
    expect(result.fixedChargeReason).toContain("first recharge")
  })

  it("returns monotonic 5, 10, and 20 percent savings scenarios", () => {
    const result = simulateAppliance({
      startDate: "2026-05-01",
      days: 30,
      wattage: 1_500,
      hoursPerDay: 4,
      quantity: 2,
      baselineDailyUnits: 8,
      monthlyUnitsBefore: 0,
      includeFirstRechargeCharges: false,
    })

    expect(result.scenarios.map((item) => item.savingPercent)).toEqual([
      5, 10, 20,
    ])
    expect(result.scenarios[0]!.unitsSaved).toBeLessThan(
      result.scenarios[1]!.unitsSaved
    )
    expect(result.scenarios[1]!.totalSavedPoisha).toBeLessThan(
      result.scenarios[2]!.totalSavedPoisha
    )
    expect(result.fixedChargesPoisha).toBe(0)
    expect(result.fixedChargeReason).toContain("not added")
  })
})
