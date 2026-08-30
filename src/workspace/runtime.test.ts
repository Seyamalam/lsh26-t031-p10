import { describe, expect, it, vi } from "vitest"

import fixtureJson from "../../public/data/P10_import_example.json"
import { validateFixture } from "../data/fixture"
import {
  activateFixture,
  forecastIdentity,
  ForecastModelCache,
  keyedForecastValue,
  LatestRequestGuard,
  LruCache,
  MemoryControlStore,
  readLastDatasetId,
  runWithWorkerFallback,
  routeControlRead,
  routeControlWrite,
  shouldUseForecastWorker,
  shouldUseParseWorker,
  writeLastDatasetId,
} from "./runtime"

describe("workspace runtime", () => {
  it("activates a dataset and case without confusing duplicate case ids", () => {
    const fixture = validateFixture(fixtureJson)
    const changed = structuredClone(fixture)
    changed.cases[0]!.opening_balance_bdt = "999.00"
    expect(activateFixture("saved-a", changed, "IMPORT-EXAMPLE")).toMatchObject(
      {
        datasetId: "saved-a",
        caseId: "IMPORT-EXAMPLE",
        activeCase: { opening_balance_bdt: "999.00" },
      }
    )
  })

  it("stores only the selected saved dataset id in localStorage", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    }
    writeLastDatasetId(storage, "saved-1")
    expect(readLastDatasetId(storage)).toBe("saved-1")
    expect([...values.entries()]).toEqual([
      ["meterwise:selected-dataset", "saved-1"],
    ])
    writeLastDatasetId(storage, null)
    expect(readLastDatasetId(storage)).toBeNull()
  })

  it("evicts least-recently-used fixtures and caches models by versioned key", () => {
    const lru = new LruCache<string, number>(2)
    lru.set("a", 1)
    lru.set("b", 2)
    lru.get("a")
    lru.set("c", 3)
    expect(lru.get("b")).toBeUndefined()
    const cache = new ForecastModelCache<string>()
    cache.set("fingerprint", "PUB-01", "v1", "result")
    expect(cache.get("fingerprint", "PUB-01", "v1")).toBe("result")
    expect(cache.get("fingerprint", "PUB-01", "v2")).toBeUndefined()
  })

  it("never exposes a worker forecast from another fixture, case, or engine", () => {
    const currentKey = forecastIdentity("fingerprint-a", "CASE-1", "v1")
    const state = { key: currentKey, value: "forecast-a" }
    expect(keyedForecastValue(state, currentKey)).toBe("forecast-a")
    expect(
      keyedForecastValue(
        state,
        forecastIdentity("fingerprint-b", "CASE-1", "v1")
      )
    ).toBeUndefined()
    expect(
      keyedForecastValue(
        state,
        forecastIdentity("fingerprint-a", "CASE-2", "v1")
      )
    ).toBeUndefined()
    expect(
      keyedForecastValue(
        state,
        forecastIdentity("fingerprint-a", "CASE-1", "v2")
      )
    ).toBeUndefined()
  })

  it("keeps temporary controls in memory without calling persistent storage", async () => {
    const memory = new MemoryControlStore()
    const persistent = {
      get: vi.fn(async () => 99),
      set: vi.fn(async () => undefined),
    }
    await routeControlWrite(
      "temporary",
      "once:fixture",
      "CASE-1",
      "budget",
      4321,
      memory,
      persistent
    )
    await expect(
      routeControlRead<number>(
        "temporary",
        "once:fixture",
        "CASE-1",
        "budget",
        memory,
        persistent
      )
    ).resolves.toBe(4321)
    expect(persistent.set).not.toHaveBeenCalled()
    expect(persistent.get).not.toHaveBeenCalled()
  })

  it("lets only the latest async activation commit", async () => {
    const guard = new LatestRequestGuard()
    const committed: string[] = []
    let releaseFirst!: () => void
    const firstRead = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = guard.begin()
    const firstRequest = firstRead.then(() => {
      if (guard.isCurrent(first)) committed.push("A")
    })
    const second = guard.begin()
    const secondRequest = Promise.resolve().then(() => {
      if (guard.isCurrent(second)) committed.push("B")
    })
    releaseFirst()
    await Promise.all([firstRequest, secondRequest])
    expect(committed).toEqual(["B"])
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
    guard.invalidate()
    expect(guard.isCurrent(second)).toBe(false)
  })

  it("uses workers only above thresholds and falls back safely", async () => {
    expect(shouldUseParseWorker(250 * 1024, true)).toBe(false)
    expect(shouldUseParseWorker(250 * 1024 + 1, true)).toBe(true)
    expect(shouldUseForecastWorker(1000, true)).toBe(false)
    expect(shouldUseForecastWorker(1001, true)).toBe(true)
    const sync = vi.fn(() => "sync")
    await expect(
      runWithWorkerFallback(
        true,
        async () => {
          throw new Error("worker failed")
        },
        sync
      )
    ).resolves.toBe("sync")
    expect(sync).toHaveBeenCalledOnce()
  })
})
