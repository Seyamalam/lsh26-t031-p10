import type { FixtureDocument, MeterCase } from "../domain/types";

const moneyFields = ["opening_balance_bdt", "low_threshold_bdt", "low_amount_bdt", "monthly_amount_bdt"] as const;
const moneyPattern = /^\d+(?:\.\d{1,2})?$/;

export function validateFixture(input: unknown): FixtureDocument {
  if (!input || typeof input !== "object") throw new Error("The uploaded file must contain a JSON object.");
  const document = input as Partial<FixtureDocument>;
  if (document.problem_id !== "P10") throw new Error("This file is not a P10 fixture.");
  if (!Array.isArray(document.cases) || document.cases.length === 0) throw new Error("The fixture must contain at least one case.");
  const ids = new Set<string>();
  for (const candidate of document.cases) validateCase(candidate, ids);
  return document as FixtureDocument;
}

function validateCase(candidate: unknown, ids: Set<string>): asserts candidate is MeterCase {
  if (!candidate || typeof candidate !== "object") throw new Error("Every case must be an object.");
  const value = candidate as MeterCase;
  if (!value.case_id || typeof value.case_id !== "string") throw new Error("Every case needs a case_id.");
  if (ids.has(value.case_id)) throw new Error(`Duplicate case_id: ${value.case_id}`);
  ids.add(value.case_id);
  if (!moneyPattern.test(value.opening_balance_bdt)) throw new Error(`${value.case_id}: invalid opening balance.`);
  if (!Array.isArray(value.days) || value.days.length < 1) throw new Error(`${value.case_id}: no daily readings.`);
  for (let index = 0; index < value.days.length; index += 1) {
    const day = value.days[index];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isInteger(day.units) || day.units < 0) {
      throw new Error(`${value.case_id}: invalid reading at position ${index + 1}.`);
    }
    if (index > 0 && day.date <= value.days[index - 1].date) throw new Error(`${value.case_id}: readings must be in ascending order.`);
  }
  if (!Array.isArray(value.recharges)) throw new Error(`${value.case_id}: recharges must be a list.`);
  for (const recharge of value.recharges) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recharge.date) || !moneyPattern.test(recharge.amount_bdt)) {
      throw new Error(`${value.case_id}: invalid recharge.`);
    }
  }
  if (value.today !== value.days[value.days.length - 1].date) throw new Error(`${value.case_id}: today must match the last reading.`);
  if (!Number.isInteger(value.usual_daily_units) || value.usual_daily_units < 0) throw new Error(`${value.case_id}: usual daily units must be a non-negative integer.`);
  if (value.target_date <= value.today) throw new Error(`${value.case_id}: target date must be after today.`);
  if (!value.comparison || !Array.isArray(value.comparison.months) || value.comparison.months.length !== 3) {
    throw new Error(`${value.case_id}: comparison needs exactly three months.`);
  }
  if (!(["readings", "daily_units"] as unknown[]).includes(value.comparison.source)) throw new Error(`${value.case_id}: invalid comparison source.`);
  for (const field of moneyFields.slice(1)) {
    if (!moneyPattern.test(value.comparison[field])) throw new Error(`${value.case_id}: invalid comparison money field ${field}.`);
  }
  if (!moneyPattern.test(value.comparison.opening_balance_bdt)) throw new Error(`${value.case_id}: invalid comparison opening balance.`);
}

export async function loadPublishedFixture(): Promise<FixtureDocument> {
  const response = await fetch("/data/P10_prepaid_meter_public.json");
  if (!response.ok) throw new Error("Published sample data could not be loaded.");
  return validateFixture(await response.json());
}
