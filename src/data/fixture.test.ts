import { describe, expect, it } from "vitest"
import fixture from "../../public/data/P10_prepaid_meter_public.json"
import importExample from "../../public/data/P10_import_example.json"
import {
  MAX_FIXTURE_BYTES,
  parseFixtureFile,
  parseFixtureJson,
  validateFixture,
} from "./fixture"
import { parseBdt } from "../domain/money"
import { runDailyLedger } from "../domain/ledger"
import { compareHabits } from "../domain/comparison"
import { calculateRechargeNeed, forecastRunOut } from "../domain/advice"
import { forecastConsumption } from "../domain/forecast"
import type { FixtureDocument } from "../domain/types"

const cloneFixture = (): FixtureDocument =>
  structuredClone(fixture) as FixtureDocument

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

  it("keeps every accepted published case safe for all derived calculations", () => {
    for (const item of document.cases) {
      const ledger = runDailyLedger(
        parseBdt(item.opening_balance_bdt),
        item.days,
        item.recharges
      )
      expect(() => forecastConsumption(item.days, 30)).not.toThrow()
      expect(() => compareHabits(item.days, item.comparison)).not.toThrow()
      expect(ledger.at(-1)).toBeDefined()
    }
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

describe("uploaded fixture validation", () => {
  it("rejects malformed JSON with a clean message", () => {
    expect(() => parseFixtureJson("{broken")).toThrow(
      "The selected file is not valid JSON."
    )
  })

  it("rejects the wrong schema or problem", () => {
    const wrongSchema = cloneFixture()
    wrongSchema.schema_version = "1.0"
    expect(() => validateFixture(wrongSchema)).toThrow(
      "schema_version must be 2.2"
    )

    const wrongProblem = cloneFixture()
    // @ts-expect-error deliberate malformed input
    wrongProblem.problem_id = "P08"
    expect(() => validateFixture(wrongProblem)).toThrow(
      "This file is not a P10 fixture."
    )
  })

  it.each([
    [
      "impossible reading date",
      (value: ReturnType<typeof cloneFixture>): void => {
        value.cases[0]!.days[2]!.date = "2026-02-30"
      },
    ],
    [
      "null reading",
      (value: ReturnType<typeof cloneFixture>): void => {
        value.cases[0]!.days[2] = null as never
      },
    ],
    [
      "fractional reading",
      (value: ReturnType<typeof cloneFixture>): void => {
        value.cases[0]!.days[2]!.units = 2.5
      },
    ],
    [
      "invalid target date",
      (value: ReturnType<typeof cloneFixture>): void => {
        value.cases[0]!.target_date = "2026-13-02"
      },
    ],
    [
      "invalid recharge date",
      (value: ReturnType<typeof cloneFixture>): void => {
        value.cases[0]!.recharges[0]!.date = "not-a-date"
      },
    ],
  ] as const)("rejects %s", (_label, mutate) => {
    const value = cloneFixture()
    mutate(value)
    expect(() => validateFixture(value)).toThrow()
  })

  it.each([
    ["invalid month", ["2026-04", "2026-13", "2026-06"]],
    ["duplicate month", ["2026-04", "2026-04", "2026-06"]],
    ["month absent from readings", ["2026-04", "2026-05", "2025-12"]],
  ])("rejects an %s", (_label, months) => {
    const value = cloneFixture()
    value.cases[0]!.comparison.months = months
    expect(() => validateFixture(value)).toThrow()
  })

  it.each([null, -1, 1.5])(
    "rejects daily_units=%s for a daily_units comparison",
    (dailyUnits) => {
      const value = cloneFixture()
      value.cases[0]!.comparison.source = "daily_units"
      value.cases[0]!.comparison.daily_units = dailyUnits
      expect(() => validateFixture(value)).toThrow("daily_units")
    }
  )

  it("rejects an oversized file before reading its contents", async () => {
    let read = false
    const file = {
      size: MAX_FIXTURE_BYTES + 1,
      text: async () => {
        read = true
        return JSON.stringify(fixture)
      },
    }

    await expect(parseFixtureFile(file)).rejects.toThrow("5 MiB")
    expect(read).toBe(false)
  })

  it("rejects ZIP and accepts JSON with a blank browser MIME type", async () => {
    const source = JSON.stringify(fixture)
    await expect(
      parseFixtureFile({
        size: source.length,
        name: "fixture.zip",
        type: "application/zip",
        text: async () => source,
      })
    ).rejects.toThrow("Choose a JSON fixture file")

    await expect(
      parseFixtureFile({
        size: source.length,
        name: "fixture.json",
        type: "",
        text: async () => source,
      })
    ).resolves.toMatchObject({ problem_id: "P10" })
  })
})
