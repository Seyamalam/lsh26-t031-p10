import { monthOf } from "./dates";
import { parseBdt, vatOnEnergy } from "./money";
import { allocateSlabs, energyCost, FIXED_CHARGES_POISHA } from "./tariff";
import type { ComparisonConfig, CostTotals, DayReading } from "./types";

function runPolicy(
  days: DayReading[],
  openingPoisha: number,
  shouldRecharge: (day: DayReading, openingBalance: number) => number,
): CostTotals {
  let balance = openingPoisha;
  let monthlyUnits = 0;
  let month = "";
  let energyPoisha = 0;
  let vatPoisha = 0;
  let fixedPoisha = 0;
  let depositsPoisha = 0;
  let rechargeCount = 0;
  const chargedMonths = new Set<string>();

  for (const day of days) {
    if (monthOf(day.date) !== month) {
      month = monthOf(day.date);
      monthlyUnits = 0;
    }
    const recharge = shouldRecharge(day, balance);
    if (recharge > 0) {
      balance += recharge;
      depositsPoisha += recharge;
      rechargeCount += 1;
      if (!chargedMonths.has(month)) {
        balance -= FIXED_CHARGES_POISHA;
        fixedPoisha += FIXED_CHARGES_POISHA;
        chargedMonths.add(month);
      }
    }
    const dailyEnergy = energyCost(allocateSlabs(monthlyUnits, day.units));
    const dailyVat = vatOnEnergy(dailyEnergy);
    monthlyUnits += day.units;
    energyPoisha += dailyEnergy;
    vatPoisha += dailyVat;
    balance -= dailyEnergy + dailyVat;
  }
  return {
    energyPoisha,
    vatPoisha,
    fixedPoisha,
    costPoisha: energyPoisha + vatPoisha + fixedPoisha,
    depositsPoisha,
    endingBalancePoisha: balance,
    rechargeCount,
  };
}

export function compareHabits(allDays: DayReading[], config: ComparisonConfig) {
  const monthSet = new Set(config.months);
  let days = allDays.filter((day) => monthSet.has(monthOf(day.date)));
  if (config.source === "daily_units") {
    if (!Number.isInteger(config.daily_units) || (config.daily_units ?? -1) < 0) throw new Error("Comparison daily_units is invalid.");
    days = days.map((day) => ({ ...day, units: config.daily_units! }));
  }
  if (days.length === 0) throw new Error("Comparison months have no daily readings.");
  const openingPoisha = parseBdt(config.opening_balance_bdt);
  const thresholdPoisha = parseBdt(config.low_threshold_bdt);
  const lowAmountPoisha = parseBdt(config.low_amount_bdt);
  const monthlyAmountPoisha = parseBdt(config.monthly_amount_bdt);
  const lowBalance = runPolicy(days, openingPoisha, (_day, balance) =>
    balance < thresholdPoisha ? lowAmountPoisha : 0,
  );
  const monthly = runPolicy(days, openingPoisha, (day) =>
    day.date.endsWith("-01") ? monthlyAmountPoisha : 0,
  );
  const invariant = lowBalance.energyPoisha === monthly.energyPoisha && lowBalance.vatPoisha === monthly.vatPoisha;
  return {
    lowBalance,
    monthly,
    invariant,
    differencePoisha: Math.abs(lowBalance.costPoisha - monthly.costPoisha),
    cheaper: lowBalance.costPoisha === monthly.costPoisha ? "equal" : lowBalance.costPoisha < monthly.costPoisha ? "low" : "monthly",
    days: days.length,
  } as const;
}
