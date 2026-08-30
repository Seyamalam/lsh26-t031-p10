/// <reference lib="webworker" />

import { parseFixtureJson } from "../data/fixture"

self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ ok: true, value: parseFixtureJson(event.data) })
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error ? error.message : "Fixture validation failed.",
    })
  }
}

export {}
