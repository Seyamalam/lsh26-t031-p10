import { addDays, daysBetweenInclusive, monthOf } from "./dates";
import { vatOnEnergy } from "./money";
import { allocateSlabs, energyCost, FIRST_SLAB_RATE_POISHA, FIXED_CHARGES_POISHA } from "./tariff";

type ProjectionState = { date: string; balancePoisha: number; monthlyUnits: number };

export function forecastRunOut(state: ProjectionState, usualDailyUnits: number) {
  if (state.balancePoisha <= 0) {
    return { date: state.date, days: 0, closingBalancePoisha: state.balancePoisha };
  }
  let balance = state.balancePoisha;
  let units = state.monthlyUnits;
  let month = monthOf(state.date);
  for (let offset = 1; offset <= 3_650; offset += 1) {
    const date = addDays(state.date, offset);
    if (monthOf(date) !== month) {
      month = monthOf(date);
      units = 0;
    }
    const allocations = allocateSlabs(units, usualDailyUnits);
    const energyPoisha = energyCost(allocations);
    const vatPoisha = vatOnEnergy(energyPoisha);
    balance -= energyPoisha + vatPoisha;
    units += usualDailyUnits;
    if (balance <= 0) return { date, days: offset, closingBalancePoisha: balance };
  }
  return null;
}

export type RechargeAdvice = {
  targetDate: string;
  projectedDays: number;
  projectedUnits: number;
  baselineEnergyPoisha: number;
  higherSlabPoisha: number;
  energyPoisha: number;
  vatPoisha: number;
  fixedPoisha: number;
  balanceCreditPoisha: number;
  rechargeNeededPoisha: number;
};

export function calculateRechargeNeed(
  state: ProjectionState,
  targetDate: string,
  usualDailyUnits: number,
  alreadyRechargedThisMonth: boolean,
): RechargeAdvice {
  if (targetDate <= state.date) throw new Error("Target date must be after today.");
  const futureDates = daysBetweenInclusive(addDays(state.date, 1), targetDate);
  let units = state.monthlyUnits;
  let month = monthOf(state.date);
  let energyPoisha = 0;
  for (const date of futureDates) {
    if (monthOf(date) !== month) {
      month = monthOf(date);
      units = 0;
    }
    const allocations = allocateSlabs(units, usualDailyUnits);
    energyPoisha += energyCost(allocations);
    units += usualDailyUnits;
  }
  const projectedUnits = futureDates.length * usualDailyUnits;
  const baselineEnergyPoisha = projectedUnits * FIRST_SLAB_RATE_POISHA;
  const higherSlabPoisha = energyPoisha - baselineEnergyPoisha;
  const vatPoisha = vatOnEnergy(energyPoisha);
  const energyShortfall = energyPoisha + vatPoisha - state.balancePoisha;
  const fixedPoisha = energyShortfall > 0 && !alreadyRechargedThisMonth ? FIXED_CHARGES_POISHA : 0;
  return {
    targetDate,
    projectedDays: futureDates.length,
    projectedUnits,
    baselineEnergyPoisha,
    higherSlabPoisha,
    energyPoisha,
    vatPoisha,
    fixedPoisha,
    balanceCreditPoisha: state.balancePoisha,
    rechargeNeededPoisha: Math.max(0, energyPoisha + vatPoisha + fixedPoisha - state.balancePoisha),
  };
}
