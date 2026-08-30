import type { CostTotals, DailyLedgerRow } from "./types"

function csvCell(value: string | number | boolean) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvRow(values: Array<string | number | boolean>) {
  return values.map(csvCell).join(",")
}

function bdtValue(poisha: number) {
  return (poisha / 100).toFixed(2)
}

export function ledgerCsv(caseId: string, rows: DailyLedgerRow[]) {
  const header = csvRow([
    "case_id",
    "date",
    "opening_balance_bdt",
    "units",
    "month_units_before",
    "month_units_after",
    "slab_trace",
    "recharge_bdt",
    "fixed_charges_bdt",
    "energy_bdt",
    "vat_bdt",
    "closing_balance_bdt",
  ])

  const body = rows.map((row) => csvRow([
    caseId,
    row.date,
    bdtValue(row.openingBalancePoisha),
    row.units,
    row.monthlyUnitsBefore,
    row.monthlyUnitsAfter,
    row.slabAllocations
      .map((part) => `${part.label}: ${part.units} units at ${bdtValue(part.ratePoisha)} BDT = ${bdtValue(part.costPoisha)} BDT`)
      .join("; "),
    bdtValue(row.rechargePoisha),
    bdtValue(row.fixedChargesPoisha),
    bdtValue(row.energyCostPoisha),
    bdtValue(row.vatPoisha),
    bdtValue(row.closingBalancePoisha),
  ]))

  return [header, ...body].join("\r\n") + "\r\n"
}

type ComparisonCsvInput = {
  caseId: string
  months: string[]
  lowBalance: CostTotals
  monthly: CostTotals
  invariant: boolean
  differencePoisha: number
  cheaper: "equal" | "low" | "monthly"
}

export function comparisonCsv(input: ComparisonCsvInput) {
  const header = csvRow([
    "case_id",
    "months",
    "habit",
    "energy_bdt",
    "vat_bdt",
    "fixed_charges_bdt",
    "consumed_cost_bdt",
    "deposits_bdt",
    "ending_balance_bdt",
    "recharges",
    "energy_vat_invariant",
    "cheaper_habit",
    "cost_difference_bdt",
  ])
  const shared = [
    input.caseId,
    input.months.join(" | "),
  ]
  const result = input.cheaper === "equal" ? "equal" : input.cheaper === "low" ? "low balance" : "monthly"
  const policyRow = (habit: string, values: CostTotals) => csvRow([
    ...shared,
    habit,
    bdtValue(values.energyPoisha),
    bdtValue(values.vatPoisha),
    bdtValue(values.fixedPoisha),
    bdtValue(values.costPoisha),
    bdtValue(values.depositsPoisha),
    bdtValue(values.endingBalancePoisha),
    values.rechargeCount,
    input.invariant ? "pass" : "fail",
    result,
    bdtValue(input.differencePoisha),
  ])

  return [header, policyRow("low balance", input.lowBalance), policyRow("monthly", input.monthly)].join("\r\n") + "\r\n"
}
