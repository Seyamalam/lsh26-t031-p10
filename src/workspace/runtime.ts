import type { FixtureDocument, MeterCase } from "../domain/types"

export const LAST_DATASET_KEY = "meterwise:selected-dataset"
export const FORECAST_ENGINE_VERSION = "forecast-v1"
export type WorkspaceDatasetKind = "bundled" | "saved" | "temporary"

export const forecastIdentity = (
  fingerprint: string,
  caseId: string,
  version: string
) => JSON.stringify([fingerprint, caseId, version])

export function keyedForecastValue<T>(
  state: { key: string; value: T } | null,
  expectedKey: string
): T | undefined {
  return state?.key === expectedKey ? state.value : undefined
}

const controlIdentity = (datasetId: string, caseId: string, scope: string) =>
  JSON.stringify([datasetId, caseId, scope])

export class MemoryControlStore {
  private values = new Map<string, unknown>()

  get<T>(datasetId: string, caseId: string, scope: string): T | undefined {
    return this.values.get(controlIdentity(datasetId, caseId, scope)) as
      | T
      | undefined
  }

  set(datasetId: string, caseId: string, scope: string, value: unknown): void {
    this.values.set(controlIdentity(datasetId, caseId, scope), value)
  }
}

type PersistentControlAdapter = {
  get: () => Promise<unknown>
  set: (value: unknown) => Promise<void>
}

export async function routeControlRead<T>(
  kind: WorkspaceDatasetKind,
  datasetId: string,
  caseId: string,
  scope: string,
  memory: MemoryControlStore,
  persistent: PersistentControlAdapter
): Promise<T | undefined> {
  if (kind === "temporary") return memory.get<T>(datasetId, caseId, scope)
  return (await persistent.get()) as T | undefined
}

export async function routeControlWrite(
  kind: WorkspaceDatasetKind,
  datasetId: string,
  caseId: string,
  scope: string,
  value: unknown,
  memory: MemoryControlStore,
  persistent: PersistentControlAdapter
): Promise<void> {
  if (kind === "temporary") {
    memory.set(datasetId, caseId, scope, value)
    return
  }
  await persistent.set(value)
}

export class LatestRequestGuard {
  private latest = 0

  begin(): number {
    this.latest += 1
    return this.latest
  }

  invalidate(): void {
    this.latest += 1
  }

  isCurrent(request: number): boolean {
    return request === this.latest
  }
}

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
  private cache = new Map<string, { fingerprint: string; value: T }>()
  get(fingerprint: string, caseId: string, version: string): T | undefined {
    return this.cache.get(forecastIdentity(fingerprint, caseId, version))?.value
  }
  set(fingerprint: string, caseId: string, version: string, value: T): void {
    this.cache.set(forecastIdentity(fingerprint, caseId, version), {
      fingerprint,
      value,
    })
  }
  clearFingerprint(fingerprint: string): void {
    for (const [key, entry] of this.cache)
      if (entry.fingerprint === fingerprint) this.cache.delete(key)
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
