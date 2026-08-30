/// <reference lib="webworker" />

import { forecastConsumption } from "../domain/forecast"
import type { DayReading } from "../domain/types"

self.onmessage = (event: MessageEvent<DayReading[]>) => {
  try {
    self.postMessage({ ok: true, value: forecastConsumption(event.data, 30) })
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Forecast failed.",
    })
  }
}

export {}
