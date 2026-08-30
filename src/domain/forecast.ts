import { addDays } from "./dates"
import type { DayReading } from "./types"

export type ForecastMetrics = {
  label: string
  mae: number
  rmse: number
}

export type ForecastEvaluation = {
  holdoutDays: number
  trainingDays: number
  regression: ForecastMetrics
  baseline: ForecastMetrics
  selectedModel: "regression" | "baseline"
  reason: string
}

export type ForecastPoint = {
  date: string
  predictedUnits: number
  lowerUnits: number
  upperUnits: number
}

export type ForecastBundle = {
  evaluation: ForecastEvaluation
  points: ForecastPoint[]
  explanation: {
    model: string
    features: string
    confidence: string
  }
}

type FittedRegression = {
  coefficients: number[]
  means: number[]
  scales: number[]
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits))

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rawFeatures(
  history: DayReading[],
  date: string,
  index: number
): number[] {
  const weekday = dayOfWeek(date)
  const lastSeven = history.slice(-7).map((item) => item.units)
  return [
    index / 100,
    Math.sin((2 * Math.PI * weekday) / 7),
    Math.cos((2 * Math.PI * weekday) / 7),
    history.at(-1)?.units ?? 0,
    history.at(-7)?.units ?? history.at(-1)?.units ?? 0,
    mean(lastSeven),
  ]
}

function solve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index] ?? 0])

  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row]?.[column] ?? 0) >
        Math.abs(augmented[pivot]?.[column] ?? 0)
      )
        pivot = row
    }
    ;[augmented[column], augmented[pivot]] = [
      augmented[pivot]!,
      augmented[column]!,
    ]
    const divisor = augmented[column]?.[column] ?? 0
    if (Math.abs(divisor) < 1e-10) continue
    for (let cursor = column; cursor <= size; cursor += 1)
      augmented[column]![cursor] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row]?.[column] ?? 0
      for (let cursor = column; cursor <= size; cursor += 1) {
        augmented[row]![cursor] -= factor * (augmented[column]?.[cursor] ?? 0)
      }
    }
  }
  return augmented.map(
    (row, index) => row[size] ?? (index === 0 ? mean(vector) : 0)
  )
}

function fitRegression(
  readings: DayReading[],
  ridgePenalty = 0.8
): FittedRegression {
  if (readings.length < 15)
    throw new Error(
      "At least 15 readings are required to fit the forecast model."
    )
  const samples = readings.slice(7).map((reading, offset) => ({
    x: rawFeatures(readings.slice(0, offset + 7), reading.date, offset + 7),
    y: reading.units,
  }))
  const featureCount = samples[0]!.x.length
  const means = Array.from({ length: featureCount }, (_, column) =>
    mean(samples.map((sample) => sample.x[column]!))
  )
  const scales = means.map((featureMean, column) => {
    const variance = mean(
      samples.map((sample) => (sample.x[column]! - featureMean) ** 2)
    )
    return Math.sqrt(variance) || 1
  })
  const rows = samples.map((sample) => [
    1,
    ...sample.x.map(
      (value, column) => (value - means[column]!) / scales[column]!
    ),
  ])
  const size = featureCount + 1
  const xtx = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) =>
      rows.reduce((sum, values) => sum + values[row]! * values[column]!, 0)
    )
  )
  for (let index = 1; index < size; index += 1)
    xtx[index]![index] += ridgePenalty
  const xty = Array.from({ length: size }, (_, column) =>
    rows.reduce(
      (sum, values, index) => sum + values[column]! * samples[index]!.y,
      0
    )
  )
  return { coefficients: solve(xtx, xty), means, scales }
}

function regressionPrediction(
  model: FittedRegression,
  history: DayReading[],
  date: string,
  index: number
): number {
  const normalized = rawFeatures(history, date, index).map(
    (value, column) => (value - model.means[column]!) / model.scales[column]!
  )
  return Math.max(
    0,
    model.coefficients[0]! +
      normalized.reduce(
        (sum, value, column) => sum + value * model.coefficients[column + 1]!,
        0
      )
  )
}

function baselinePrediction(history: DayReading[]): number {
  return Math.max(0, mean(history.slice(-7).map((reading) => reading.units)))
}

function predictSeries(
  seed: DayReading[],
  dates: string[],
  predictor: (history: DayReading[], date: string, index: number) => number
): number[] {
  const history = [...seed]
  return dates.map((date, offset) => {
    const units = predictor(history, date, seed.length + offset)
    history.push({ date, units })
    return units
  })
}

function metrics(
  label: string,
  actual: number[],
  predicted: number[]
): ForecastMetrics {
  const errors = actual.map((value, index) => value - predicted[index]!)
  return {
    label,
    mae: round(mean(errors.map((value) => Math.abs(value)))),
    rmse: round(Math.sqrt(mean(errors.map((value) => value ** 2)))),
  }
}

export function evaluateForecastModels(
  readings: DayReading[],
  holdoutDays = 30
): ForecastEvaluation {
  if (!Number.isInteger(holdoutDays) || holdoutDays < 7)
    throw new Error("Holdout length must be at least 7 days.")
  if (readings.length < holdoutDays + 30)
    throw new Error("At least 30 training days plus the holdout are required.")
  const training = readings.slice(0, -holdoutDays)
  const holdout = readings.slice(-holdoutDays)
  const model = fitRegression(training)
  const dates = holdout.map((reading) => reading.date)
  const actual = holdout.map((reading) => reading.units)
  const regression = metrics(
    "Ridge regression",
    actual,
    predictSeries(training, dates, (history, date, index) =>
      regressionPrediction(model, history, date, index)
    )
  )
  const baseline = metrics(
    "7-day mean",
    actual,
    predictSeries(training, dates, (history) => baselinePrediction(history))
  )
  const selectedModel =
    regression.rmse <= baseline.rmse ? "regression" : "baseline"
  const selected = selectedModel === "regression" ? regression : baseline
  const rejected = selectedModel === "regression" ? baseline : regression
  return {
    holdoutDays,
    trainingDays: training.length,
    regression,
    baseline,
    selectedModel,
    reason: `${selected.label} selected for lower holdout RMSE (${selected.rmse.toFixed(3)} versus ${rejected.rmse.toFixed(3)} units).`,
  }
}

export function forecastConsumption(
  readings: DayReading[],
  horizonDays = 30
): ForecastBundle {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 90)
    throw new Error("Forecast horizon must be between 1 and 90 days.")
  const evaluation = evaluateForecastModels(readings, 30)
  const model = fitRegression(readings)
  const lastDate = readings.at(-1)?.date
  if (!lastDate) throw new Error("Readings are required for forecasting.")
  const dates = Array.from({ length: horizonDays }, (_, index) =>
    addDays(lastDate, index + 1)
  )
  const predictions =
    evaluation.selectedModel === "regression"
      ? predictSeries(readings, dates, (history, date, index) =>
          regressionPrediction(model, history, date, index)
        )
      : predictSeries(readings, dates, (history) => baselinePrediction(history))
  const selectedMetrics =
    evaluation.selectedModel === "regression"
      ? evaluation.regression
      : evaluation.baseline
  const margin = 1.645 * selectedMetrics.rmse
  return {
    evaluation,
    points: dates.map((date, index) => ({
      date,
      predictedUnits: round(predictions[index]!),
      lowerUnits: round(Math.max(0, predictions[index]! - margin)),
      upperUnits: round(predictions[index]! + margin),
    })),
    explanation: {
      model:
        evaluation.selectedModel === "regression"
          ? "Regularized linear regression"
          : "Trailing 7-day mean",
      features:
        "Trend, day-of-week seasonality, previous day, previous week, and trailing 7-day mean.",
      confidence:
        "RMSE uncertainty band = prediction ± 1.645 × selected model holdout RMSE. It is an error guide, not a calibrated probability interval.",
    },
  }
}
