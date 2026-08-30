import type {
  ComparisonConfig,
  FixtureDocument,
  MeterCase,
} from "../domain/types"
import { addDays } from "../domain/dates"

export const MAX_FIXTURE_BYTES = 5 * 1024 * 1024

type FixtureFile = {
  size: number
  name?: string
  type?: string
  text: () => Promise<string>
}

const moneyPattern = /^\d+(?:\.\d{1,2})?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const monthLengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= monthLengths[month - 1]!
}

function isCalendarMonth(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12)
}

function isMoney(value: unknown): value is string {
  if (typeof value !== "string" || !moneyPattern.test(value)) return false
  const [whole] = value.split(".")
  return (
    Number.isSafeInteger(Number(whole)) &&
    Number(whole) <= Number.MAX_SAFE_INTEGER / 100
  )
}

function requireMoney(
  value: unknown,
  message: string
): asserts value is string {
  if (!isMoney(value)) throw new Error(message)
}

export function validateFixture(input: unknown): FixtureDocument {
  if (!isRecord(input))
    throw new Error("The uploaded file must contain a JSON object.")
  if (input.schema_version !== "2.2")
    throw new Error("Fixture schema_version must be 2.2.")
  if (input.problem_id !== "P10")
    throw new Error("This file is not a P10 fixture.")
  if (!Array.isArray(input.cases) || input.cases.length === 0)
    throw new Error("The fixture must contain at least one case.")
  const ids = new Set<string>()
  const cases = input.cases.map((candidate) => validateCase(candidate, ids))
  return {
    schema_version: input.schema_version,
    problem_id: input.problem_id,
    ...(typeof input.format_note === "string"
      ? { format_note: input.format_note }
      : {}),
    cases,
  }
}

function validateCase(candidate: unknown, ids: Set<string>): MeterCase {
  if (!isRecord(candidate)) throw new Error("Every case must be an object.")
  const caseId = candidate.case_id
  if (typeof caseId !== "string" || caseId.trim() === "")
    throw new Error("Every case needs a case_id.")
  if (ids.has(caseId)) throw new Error(`Duplicate case_id: ${caseId}`)
  ids.add(caseId)
  requireMoney(
    candidate.opening_balance_bdt,
    `${caseId}: invalid opening balance.`
  )

  if (!Array.isArray(candidate.days) || candidate.days.length < 60)
    throw new Error(
      `${caseId}: at least 60 daily readings are required for ledger and forecast checks.`
    )
  let priorDate = ""
  const days = candidate.days.map((day, index) => {
    if (
      !isRecord(day) ||
      !isCalendarDate(day.date) ||
      !Number.isSafeInteger(day.units) ||
      (day.units as number) < 0
    ) {
      throw new Error(`${caseId}: invalid reading at position ${index + 1}.`)
    }
    if (index > 0 && day.date <= priorDate) {
      throw new Error(
        `${caseId}: readings must have unique dates in ascending order.`
      )
    }
    if (index > 0 && day.date !== addDays(priorDate, 1)) {
      throw new Error(`${caseId}: daily readings must be consecutive.`)
    }
    priorDate = day.date
    return { date: day.date, units: day.units as number }
  })

  if (!Array.isArray(candidate.recharges))
    throw new Error(`${caseId}: recharges must be a list.`)
  const recharges = candidate.recharges.map((recharge, index) => {
    if (!isRecord(recharge) || !isCalendarDate(recharge.date))
      throw new Error(`${caseId}: invalid recharge at position ${index + 1}.`)
    requireMoney(
      recharge.amount_bdt,
      `${caseId}: invalid recharge at position ${index + 1}.`
    )
    if (recharge.date < days[0]!.date || recharge.date > days.at(-1)!.date)
      throw new Error(
        `${caseId}: recharge dates must stay within the reading range.`
      )
    return { date: recharge.date, amount_bdt: recharge.amount_bdt }
  })

  if (!isCalendarDate(candidate.today))
    throw new Error(`${caseId}: today must be a valid calendar date.`)
  if (candidate.today !== days.at(-1)!.date)
    throw new Error(`${caseId}: today must match the last reading.`)
  if (
    !Number.isSafeInteger(candidate.usual_daily_units) ||
    (candidate.usual_daily_units as number) < 0
  ) {
    throw new Error(
      `${caseId}: usual daily units must be a non-negative integer.`
    )
  }
  if (
    !isCalendarDate(candidate.target_date) ||
    candidate.target_date <= candidate.today
  ) {
    throw new Error(`${caseId}: target date must be a valid date after today.`)
  }
  const comparison = validateComparison(candidate.comparison, caseId, days)
  return {
    case_id: caseId,
    opening_balance_bdt: candidate.opening_balance_bdt,
    days,
    recharges,
    today: candidate.today,
    usual_daily_units: candidate.usual_daily_units as number,
    target_date: candidate.target_date,
    comparison,
  }
}

function validateComparison(
  candidate: unknown,
  caseId: string,
  days: MeterCase["days"]
): ComparisonConfig {
  if (!isRecord(candidate))
    throw new Error(`${caseId}: comparison must be an object.`)
  if (!Array.isArray(candidate.months) || candidate.months.length !== 3)
    throw new Error(`${caseId}: comparison needs exactly three months.`)
  const months = candidate.months
  if (!months.every(isCalendarMonth))
    throw new Error(`${caseId}: comparison contains an invalid month.`)
  if (new Set(months).size !== months.length)
    throw new Error(`${caseId}: comparison months must be unique.`)
  const readingMonths = new Set(days.map((day) => day.date.slice(0, 7)))
  if (months.some((month) => !readingMonths.has(month)))
    throw new Error(`${caseId}: every comparison month must occur in readings.`)
  const readingDates = new Set(days.map((day) => day.date))
  if (months.some((month) => !readingDates.has(`${month}-01`)))
    throw new Error(`${caseId}: every comparison month must include day 1.`)
  if (candidate.source !== "readings" && candidate.source !== "daily_units")
    throw new Error(`${caseId}: invalid comparison source.`)
  if (
    candidate.source === "daily_units" &&
    (!Number.isSafeInteger(candidate.daily_units) ||
      (candidate.daily_units as number) < 0)
  ) {
    throw new Error(
      `${caseId}: comparison daily_units must be a non-negative integer.`
    )
  }
  if (
    candidate.source === "readings" &&
    candidate.daily_units !== null &&
    candidate.daily_units !== undefined
  ) {
    throw new Error(
      `${caseId}: comparison daily_units must be null when source is readings.`
    )
  }
  requireMoney(
    candidate.opening_balance_bdt,
    `${caseId}: invalid comparison opening balance.`
  )
  requireMoney(
    candidate.low_threshold_bdt,
    `${caseId}: invalid comparison low_threshold_bdt.`
  )
  requireMoney(
    candidate.low_amount_bdt,
    `${caseId}: invalid comparison low_amount_bdt.`
  )
  requireMoney(
    candidate.monthly_amount_bdt,
    `${caseId}: invalid comparison monthly_amount_bdt.`
  )
  return {
    months: [...months],
    source: candidate.source,
    daily_units:
      candidate.source === "daily_units"
        ? (candidate.daily_units as number)
        : null,
    opening_balance_bdt: candidate.opening_balance_bdt,
    low_threshold_bdt: candidate.low_threshold_bdt,
    low_amount_bdt: candidate.low_amount_bdt,
    monthly_amount_bdt: candidate.monthly_amount_bdt,
  }
}

export function parseFixtureJson(source: string): FixtureDocument {
  try {
    return validateFixture(JSON.parse(source))
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("The selected file is not valid JSON.")
    throw error
  }
}

export async function parseFixtureFile(
  file: FixtureFile
): Promise<FixtureDocument> {
  if (file.size > MAX_FIXTURE_BYTES)
    throw new Error("Fixture JSON must be 5 MiB or smaller.")
  const extensionIsJson = file.name?.toLowerCase().endsWith(".json") ?? false
  const mimeIsJson = file.type === "application/json"
  if (file.name && !mimeIsJson && !extensionIsJson)
    throw new Error(
      "Choose a JSON fixture file. ZIP and other formats are not accepted."
    )
  return parseFixtureJson(await file.text())
}

export async function loadPublishedFixture(): Promise<FixtureDocument> {
  const response = await fetch("/data/P10_prepaid_meter_public.json")
  if (!response.ok)
    throw new Error("Published sample data could not be loaded.")
  return validateFixture(await response.json())
}
