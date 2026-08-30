import { monthOf } from "./dates";
import { parseBdt, vatOnEnergy } from "./money";
import { allocateSlabs, energyCost, FIXED_CHARGES_POISHA } from "./tariff";
import type { DailyLedgerRow, DayReading, Recharge } from "./types";

export function runDailyLedger(
  openingBalancePoisha: number,
  days: DayReading[],
  recharges: Recharge[],
): DailyLedgerRow[] {
  const rechargeByDate = new Map<string, number>();
  for (const recharge of recharges) {
    rechargeByDate.set(recharge.date, (rechargeByDate.get(recharge.date) ?? 0) + parseBdt(recharge.amount_bdt));
  }

  let balance = openingBalancePoisha;
  let currentMonth = "";
  let monthlyUnits = 0;
  const chargedMonths = new Set<string>();

  return days.map((day) => {
    const month = monthOf(day.date);
    if (month !== currentMonth) {
      currentMonth = month;
      monthlyUnits = 0;
    }
    const openingBalancePoisha = balance;
    const rechargePoisha = rechargeByDate.get(day.date) ?? 0;
    const fixedChargesPoisha = rechargePoisha > 0 && !chargedMonths.has(month) ? FIXED_CHARGES_POISHA : 0;
    if (rechargePoisha > 0) chargedMonths.add(month);
    const monthlyUnitsBefore = monthlyUnits;
    const slabAllocations = allocateSlabs(monthlyUnitsBefore, day.units);
    const energyCostPoisha = energyCost(slabAllocations);
    const vatPoisha = vatOnEnergy(energyCostPoisha);
    monthlyUnits += day.units;
    balance += rechargePoisha - fixedChargesPoisha - energyCostPoisha - vatPoisha;

    return {
      date: day.date,
      openingBalancePoisha,
      rechargePoisha,
      fixedChargesPoisha,
      monthlyUnitsBefore,
      units: day.units,
      monthlyUnitsAfter: monthlyUnits,
      slabAllocations,
      energyCostPoisha,
      vatPoisha,
      closingBalancePoisha: balance,
    };
  });
}
