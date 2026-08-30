import { describe, expect, it } from "vitest"
import fixture from "../../public/data/P10_prepaid_meter_public.json"
import importExample from "../../public/data/P10_import_example.json"
import { validateFixture } from "./fixture"
import { parseBdt } from "../domain/money"
import { runDailyLedger } from "../domain/ledger"
import { compareHabits } from "../domain/comparison"
import { calculateRechargeNeed, forecastRunOut } from "../domain/advice"

describe("all published P10 cases", () => {
  const document = validateFixture(fixture)

  it("loads all 25 cases through the public validation path", () => {
    expect(document.cases).toHaveLength(25)
  })

  it("keeps the checked-in import example valid", () => {
    expect(validateFixture(importExample).cases[0].case_id).toBe(
      "IMPORT-EXAMPLE"
    )
  })

  it.each(document.cases.map((item) => [item.case_id, item] as const))(
    "%s preserves tariff invariants end to end",
    (_id, item) => {
      const ledger = runDailyLedger(
        parseBdt(item.opening_balance_bdt),
        item.days,
        item.recharges
      )
      expect(ledger).toHaveLength(item.days.length)
      expect(
        ledger.every((row) => row.energyCostPoisha >= 0 && row.vatPoisha >= 0)
      ).toBe(true)
      const last = ledger.at(-1)!
      const comparison = compareHabits(item.days, item.comparison)
      expect(comparison.invariant).toBe(true)
      expect(comparison.lowBalance.energyPoisha).toBe(
        comparison.monthly.energyPoisha
      )
      expect(comparison.lowBalance.vatPoisha).toBe(comparison.monthly.vatPoisha)
      expect(comparison.differencePoisha).toBe(
        Math.abs(
          comparison.lowBalance.fixedPoisha - comparison.monthly.fixedPoisha
        )
      )
      expect(
        forecastRunOut(
          {
            date: item.today,
            balancePoisha: last.closingBalancePoisha,
            monthlyUnits: last.monthlyUnitsAfter,
          },
          item.usual_daily_units
        )
      ).not.toBeNull()
      const advice = calculateRechargeNeed(
        {
          date: item.today,
          balancePoisha: last.closingBalancePoisha,
          monthlyUnits: last.monthlyUnitsAfter,
        },
        item.target_date,
        item.usual_daily_units,
        item.recharges.some(
          (recharge) => recharge.date.slice(0, 7) === item.today.slice(0, 7)
        )
      )
      expect(advice.baselineEnergyPoisha + advice.higherSlabPoisha).toBe(
        advice.energyPoisha
      )
      expect(advice.rechargeNeededPoisha).toBeGreaterThanOrEqual(0)
    }
  )
})
