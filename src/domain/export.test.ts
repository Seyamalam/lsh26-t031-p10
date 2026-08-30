import { describe, expect, it } from "vitest"

import { comparisonCsv, ledgerCsv } from "./export"
import type { CostTotals, DailyLedgerRow } from "./types"

const ledgerRow: DailyLedgerRow = {
  date: "2026-01-01",
  openingBalancePoisha: 10_050,
  rechargePoisha: 20_000,
  fixedChargesPoisha: 8_200,
  monthlyUnitsBefore: 74,
  units: 2,
  monthlyUnitsAfter: 76,
  slabAllocations: [
    { label: "1-75", from: 1, to: 75, units: 1, ratePoisha: 463, costPoisha: 463 },
    { label: "76-200", from: 76, to: 200, units: 1, ratePoisha: 526, costPoisha: 526 },
  ],
  energyCostPoisha: 989,
  vatPoisha: 49,
  closingBalancePoisha: 20_812,
}

const totals: CostTotals = {
  energyPoisha: 10_000,
  vatPoisha: 500,
  fixedPoisha: 8_200,
  costPoisha: 18_700,
  depositsPoisha: 50_000,
  endingBalancePoisha: 31_300,
  rechargeCount: 1,
}

describe("CSV exports", () => {
  it("exports every ledger row with money values and an escaped slab trace", () => {
    const csv = ledgerCsv("CASE,01", [ledgerRow, { ...ledgerRow, date: "2026-01-02" }])

    expect(csv.split("\r\n")).toHaveLength(4)
    expect(csv).toContain('"CASE,01",2026-01-01,100.50,2,74,76')
    expect(csv).toContain("1-75: 1 units at 4.63 BDT = 4.63 BDT; 76-200: 1 units at 5.26 BDT = 5.26 BDT")
    expect(csv).toContain(",200.00,82.00,9.89,0.49,208.12")
  })

  it("exports both comparison policies and the equality result", () => {
    const csv = comparisonCsv({
      caseId: "PUB-01",
      months: ["2026-01", "2026-02", "2026-03"],
      lowBalance: totals,
      monthly: { ...totals, fixedPoisha: 16_400, costPoisha: 26_900 },
      invariant: true,
      differencePoisha: 8_200,
      cheaper: "low",
    })

    expect(csv.split("\r\n")).toHaveLength(4)
    expect(csv).toContain("PUB-01,2026-01 | 2026-02 | 2026-03,low balance,100.00,5.00,82.00,187.00")
    expect(csv).toContain(",pass,low balance,82.00")
    expect(csv).toContain("monthly,100.00,5.00,164.00,269.00")
  })
})
