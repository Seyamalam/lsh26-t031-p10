import type { DayReading } from "../domain/types"
import type { ForecastBundle } from "../domain/forecast"
import { forecastConsumption } from "../domain/forecast"
import type { FixtureDocument } from "../domain/types"
import { parseFixtureJson } from "../data/fixture"
import {
  runWithWorkerFallback,
  shouldUseForecastWorker,
  shouldUseParseWorker,
} from "./runtime"

type WorkerReply<T> = { ok: true; value: T } | { ok: false; error: string }

function workerRequest<TInput, TOutput>(
  url: URL,
  input: TInput
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, { type: "module" })
    worker.onmessage = (event: MessageEvent<WorkerReply<TOutput>>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.value)
      else reject(new Error(event.data.error))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "Background analysis failed."))
    }
    worker.postMessage(input)
  })
}

export async function parseFixtureAccelerated(
  rawJson: string,
  byteSize: number
): Promise<{ fixture: FixtureDocument; usedWorker: boolean }> {
  const canUseWorker = typeof Worker !== "undefined"
  let usedWorker = false
  const fixture = await runWithWorkerFallback(
    shouldUseParseWorker(byteSize, canUseWorker),
    async () => {
      usedWorker = true
      return workerRequest<string, FixtureDocument>(
        new URL("./fixture.worker.ts", import.meta.url),
        rawJson
      )
    },
    () => {
      usedWorker = false
      return parseFixtureJson(rawJson)
    }
  )
  return { fixture, usedWorker }
}

export async function forecastAccelerated(
  readings: DayReading[]
): Promise<{ forecast: ForecastBundle; usedWorker: boolean }> {
  const canUseWorker = typeof Worker !== "undefined"
  let usedWorker = false
  const forecast = await runWithWorkerFallback(
    shouldUseForecastWorker(readings.length, canUseWorker),
    async () => {
      usedWorker = true
      return workerRequest<DayReading[], ForecastBundle>(
        new URL("./forecast.worker.ts", import.meta.url),
        readings
      )
    },
    () => {
      usedWorker = false
      return forecastConsumption(readings, 30)
    }
  )
  return { forecast, usedWorker }
}
