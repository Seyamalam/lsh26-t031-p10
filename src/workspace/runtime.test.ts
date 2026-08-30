import { describe, expect, it, vi } from "vitest"

import fixtureJson from "../../public/data/P10_import_example.json"
import { validateFixture } from "../data/fixture"
import {
  activateFixture,
  ForecastModelCache,
  LruCache,
  readLastDatasetId,
  runWithWorkerFallback,
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
