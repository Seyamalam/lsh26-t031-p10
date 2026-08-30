import { addDays, monthOf } from "./dates"
import { vatOnEnergy } from "./money"
import { FIXED_CHARGES_POISHA, SLABS } from "./tariff"

export type ApplianceSimulationInput = {
  startDate: string
  days: number
  wattage: number
  hoursPerDay: number
  quantity: number
  baselineDailyUnits: number
  monthlyUnitsBefore: number
  includeFirstRechargeCharges: boolean
}

export type ApplianceScenario = {
  savingPercent: 5 | 10 | 20
  unitsSaved: number
  energySavedPoisha: number
  vatSavedPoisha: number
  totalSavedPoisha: number
}

function continuousEnergyCost(monthlyUnitsBefore: number, units: number) {
  let cursor = monthlyUnitsBefore
  let remaining = units
  let costPoisha = 0
  for (const slab of SLABS) {
    if (remaining <= 1e-9) break
    if (slab.to !== null && cursor >= slab.to) continue
    const capacity = slab.to === null ? remaining : slab.to - cursor
    const allocated = Math.min(remaining, Math.max(0, capacity))
    costPoisha += allocated * slab.ratePoisha
    cursor += allocated
    remaining -= allocated
  }
  return Math.round(costPoisha)
}

function projectUsage(
  input: ApplianceSimulationInput,
  applianceDailyUnits: number
) {
  let month = monthOf(input.startDate)
  let baselineMonthlyUnits = input.monthlyUnitsBefore
  let planMonthlyUnits = input.monthlyUnitsBefore
  let baselineEnergyPoisha = 0
  let planEnergyPoisha = 0
  let baselineVatPoisha = 0
  let planVatPoisha = 0

  for (let index = 0; index < input.days; index += 1) {
    const date = addDays(input.startDate, index)
    if (monthOf(date) !== month) {
      month = monthOf(date)
      baselineMonthlyUnits = 0
      planMonthlyUnits = 0
    }
    const baselineEnergy = continuousEnergyCost(
      baselineMonthlyUnits,
      input.baselineDailyUnits
    )
    const planEnergy = continuousEnergyCost(
      planMonthlyUnits,
      input.baselineDailyUnits + applianceDailyUnits
    )
    baselineEnergyPoisha += baselineEnergy
    planEnergyPoisha += planEnergy
    baselineVatPoisha += vatOnEnergy(baselineEnergy)
    planVatPoisha += vatOnEnergy(planEnergy)
    baselineMonthlyUnits += input.baselineDailyUnits
    planMonthlyUnits += input.baselineDailyUnits + applianceDailyUnits
  }
  return {
    incrementalEnergyPoisha: planEnergyPoisha - baselineEnergyPoisha,
    incrementalVatPoisha: planVatPoisha - baselineVatPoisha,
  }
}

export function simulateAppliance(input: ApplianceSimulationInput) {
  const numericFields = [
    input.wattage,
    input.hoursPerDay,
    input.quantity,
    input.baselineDailyUnits,
    input.monthlyUnitsBefore,
  ]
  if (numericFields.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error("Appliance inputs must be non-negative numbers.")
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 366)
    throw new Error("Simulation days must be between 1 and 366.")
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    throw new Error("Quantity must be a positive integer.")
  if (input.hoursPerDay > 24) throw new Error("Hours per day cannot exceed 24.")

  const applianceDailyUnits =
    (input.wattage * input.hoursPerDay * input.quantity) / 1_000
  const applianceMonthlyUnits = applianceDailyUnits * input.days
  const full = projectUsage(input, applianceDailyUnits)
  const scenarios = ([5, 10, 20] as const).map((savingPercent) => {
    const reduced = projectUsage(
      input,
      applianceDailyUnits * (1 - savingPercent / 100)
    )
    const energySavedPoisha =
      full.incrementalEnergyPoisha - reduced.incrementalEnergyPoisha
    const vatSavedPoisha =
      full.incrementalVatPoisha - reduced.incrementalVatPoisha
    return {
      savingPercent,
      unitsSaved: Number(
        ((applianceMonthlyUnits * savingPercent) / 100).toFixed(2)
      ),
      energySavedPoisha,
      vatSavedPoisha,
      totalSavedPoisha: energySavedPoisha + vatSavedPoisha,
    }
  })
  const fixedChargesPoisha = input.includeFirstRechargeCharges
    ? FIXED_CHARGES_POISHA
    : 0
  return {
    applianceDailyUnits: Number(applianceDailyUnits.toFixed(3)),
    applianceMonthlyUnits: Number(applianceMonthlyUnits.toFixed(2)),
    incrementalEnergyPoisha: full.incrementalEnergyPoisha,
    incrementalVatPoisha: full.incrementalVatPoisha,
    fixedChargesPoisha,
    totalPlanPoisha:
      full.incrementalEnergyPoisha +
      full.incrementalVatPoisha +
      fixedChargesPoisha,
    fixedChargeReason: input.includeFirstRechargeCharges
      ? "Demand charge and meter rent are included because this plan assumes the month's first recharge."
      : "Fixed charges are not added because the appliance itself does not trigger a recharge.",
    scenarios,
  }
}
