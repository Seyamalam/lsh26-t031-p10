import type { FixtureDocument, MeterCase } from "../domain/types"

export const LAST_DATASET_KEY = "meterwise:selected-dataset"
export const FORECAST_ENGINE_VERSION = "forecast-v1"

export function activateFixture(
  datasetId: string,
  fixture: FixtureDocument,
  requestedCaseId?: string
) {
  const caseId =
    requestedCaseId &&
    fixture.cases.some((item) => item.case_id === requestedCaseId)
      ? requestedCaseId
      : fixture.cases[0].case_id
  return {
    datasetId,
    fixture,
    caseId,
    activeCase: fixture.cases.find((item) => item.case_id === caseId)!,
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">
export function readLastDatasetId(storage: StorageLike): string | null {
  return storage.getItem(LAST_DATASET_KEY)
}
export function writeLastDatasetId(
  storage: StorageLike,
  id: string | null
): void {
  if (id) storage.setItem(LAST_DATASET_KEY, id)
  else storage.removeItem(LAST_DATASET_KEY)
}

export class LruCache<K, V> {
  private values = new Map<K, V>()
  constructor(private capacity = 3) {}
  get(key: K): V | undefined {
    const value = this.values.get(key)
    if (value !== undefined) {
      this.values.delete(key)
      this.values.set(key, value)
    }
    return value
  }
  set(key: K, value: V): void {
    this.values.delete(key)
    this.values.set(key, value)
    while (this.values.size > this.capacity)
      this.values.delete(this.values.keys().next().value!)
  }
  delete(key: K): void {
    this.values.delete(key)
  }
  clear(): void {
    this.values.clear()
  }
}

export class ForecastModelCache<T> {
  private cache = new Map<string, T>()
  get(fingerprint: string, caseId: string, version: string): T | undefined {
    return this.cache.get(`${fingerprint}:${caseId}:${version}`)
  }
  set(fingerprint: string, caseId: string, version: string, value: T): void {
    this.cache.set(`${fingerprint}:${caseId}:${version}`, value)
  }
  clearFingerprint(fingerprint: string): void {
    for (const key of this.cache.keys())
      if (key.startsWith(`${fingerprint}:`)) this.cache.delete(key)
  }
}

export const shouldUseParseWorker = (
  byteSize: number,
  workerAvailable: boolean
) => workerAvailable && byteSize > 250 * 1024
export const shouldUseForecastWorker = (
  readingCount: number,
  workerAvailable: boolean
) => workerAvailable && readingCount > 1000
export async function runWithWorkerFallback<T>(
  useWorker: boolean,
  worker: () => Promise<T>,
  synchronous: () => T | Promise<T>
): Promise<T> {
  if (useWorker) {
    try {
      return await worker()
    } catch {
      return synchronous()
    }
  }
  return synchronous()
}

export type ActivatedWorkspace = {
  datasetId: string
  fixture: FixtureDocument
  caseId: string
  activeCase: MeterCase
}
