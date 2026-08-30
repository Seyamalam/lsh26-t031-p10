import { monthOf } from "./dates";
import { parseBdt } from "./money";
import type { MeterCase } from "./types";

export function summarizeMonths(caseData: MeterCase) {
  const months = new Map<string, { month: string; units: number; rechargePoisha: number; lateRechargePoisha: number }>();
  for (const day of caseData.days) {
    const month = monthOf(day.date);
    const item = months.get(month) ?? { month, units: 0, rechargePoisha: 0, lateRechargePoisha: 0 };
    item.units += day.units;
    months.set(month, item);
  }
  for (const recharge of caseData.recharges) {
    const item = months.get(monthOf(recharge.date));
    if (!item) continue;
    const amount = parseBdt(recharge.amount_bdt);
    item.rechargePoisha += amount;
    if (Number(recharge.date.slice(8, 10)) >= 24) item.lateRechargePoisha += amount;
  }
  const list = [...months.values()];
  const light = list.reduce((best, item) => (item.units < best.units ? item : best));
  const heavy = list.reduce((best, item) => (item.units > best.units ? item : best));
  const lateCandidates = list.filter((item) => item.lateRechargePoisha > 0);
  const late = lateCandidates.length
    ? lateCandidates.reduce((best, item) => (item.lateRechargePoisha > best.lateRechargePoisha ? item : best))
    : null;
  return { months: list, light, heavy, late };
}
