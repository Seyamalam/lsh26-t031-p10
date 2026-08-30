import type { FixtureDocument } from "../domain/types"

export const WORKSPACE_DB_VERSION = 2
export const WORKSPACE_DB_NAME = "meterwise-workspace"

export type DatasetRecord = {
  id: string
  name: string
  problemId: "P10"
  schemaVersion: string
  sourceFilename: string
  importedAt: string
  byteSize: number
  fingerprint: string
  caseCount: number
  earliestDate: string
  latestDate: string
  totalReadings: number
  rawJson: string
  fixture: FixtureDocument
  lastOpenedCase?: string
}

export type DatasetSummary = Omit<DatasetRecord, "rawJson" | "fixture">

type CatalogOptions = { indexedDB?: IDBFactory; databaseName?: string }
type ControlRecord = {
  key: string
  datasetId: string
  caseId: string
  scope: string
  value: unknown
  updatedAt: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."))
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("IndexedDB transaction was aborted.")
      )
  })
}

function storageError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return new Error(
      "Device storage quota is full. Export or delete a saved dataset, then try again."
    )
  if (error instanceof DOMException && error.name === "SecurityError")
    return new Error(
      "Browser privacy settings blocked device storage. Use the fixture once instead."
    )
  return error instanceof Error
    ? error
    : new Error("The device workspace could not be updated.")
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export async function createDatasetRecord(input: {
  id?: string
  name: string
  sourceFilename: string
  rawJson: string
  fixture: FixtureDocument
}): Promise<DatasetRecord> {
  const dates = input.fixture.cases.flatMap((item) =>
    item.days.map((day) => day.date)
  )
  return {
    id: input.id ?? crypto.randomUUID(),
    name:
      input.name.trim() ||
      input.sourceFilename.replace(/\.json$/i, "") ||
      "Imported dataset",
    problemId: "P10",
    schemaVersion: input.fixture.schema_version,
    sourceFilename: input.sourceFilename,
    importedAt: new Date().toISOString(),
    byteSize: new TextEncoder().encode(input.rawJson).byteLength,
    fingerprint: await sha256(input.rawJson),
    caseCount: input.fixture.cases.length,
    earliestDate: dates.reduce((earliest, date) =>
      date < earliest ? date : earliest
    ),
    latestDate: dates.reduce((latest, date) => (date > latest ? date : latest)),
    totalReadings: dates.length,
    rawJson: input.rawJson,
    fixture: input.fixture,
  }
}

export class WorkspaceCatalog {
  private factory: IDBFactory
  private databaseName: string
  private databasePromise?: Promise<IDBDatabase>

  constructor(options: CatalogOptions = {}) {
    if (!options.indexedDB && typeof indexedDB === "undefined")
      throw new Error("IndexedDB is unavailable in this browser.")
    this.factory = options.indexedDB ?? indexedDB
    this.databaseName = options.databaseName ?? WORKSPACE_DB_NAME
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(this.databaseName, WORKSPACE_DB_VERSION)
      request.onupgradeneeded = (event) => {
        const database = request.result
        const transaction = request.transaction!
        const datasets = database.objectStoreNames.contains("datasets")
          ? transaction.objectStore("datasets")
          : database.createObjectStore("datasets", { keyPath: "id" })
        if (!datasets.indexNames.contains("fingerprint"))
          datasets.createIndex("fingerprint", "fingerprint", { unique: true })
        if (!datasets.indexNames.contains("importedAt"))
          datasets.createIndex("importedAt", "importedAt")
        const controls = database.objectStoreNames.contains("controls")
          ? transaction.objectStore("controls")
          : database.createObjectStore("controls", { keyPath: "key" })
        if (!controls.indexNames.contains("datasetId"))
          controls.createIndex("datasetId", "datasetId")
        if (
          (event as IDBVersionChangeEvent).oldVersion < 2 &&
          !controls.indexNames.contains("updatedAt")
        )
          controls.createIndex("updatedAt", "updatedAt")
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(storageError(request.error))
      request.onblocked = () =>
        reject(
          new Error("Close other Meterwise tabs to upgrade device storage.")
        )
    })
    return this.databasePromise
  }

  async listDatasets(): Promise<DatasetSummary[]> {
    const database = await this.open()
    const records = (await requestResult(
      database
        .transaction("datasets", "readonly")
        .objectStore("datasets")
        .getAll()
    )) as DatasetRecord[]
    return records
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      .map((record) => ({
        id: record.id,
        name: record.name,
        problemId: record.problemId,
        schemaVersion: record.schemaVersion,
        sourceFilename: record.sourceFilename,
        importedAt: record.importedAt,
        byteSize: record.byteSize,
        fingerprint: record.fingerprint,
        caseCount: record.caseCount,
        earliestDate: record.earliestDate,
        latestDate: record.latestDate,
        totalReadings: record.totalReadings,
        lastOpenedCase: record.lastOpenedCase,
      }))
  }

  async getDataset(id: string): Promise<DatasetRecord | undefined> {
    const database = await this.open()
    return requestResult(
      database
        .transaction("datasets", "readonly")
        .objectStore("datasets")
        .get(id)
    ) as Promise<DatasetRecord | undefined>
  }

  async saveDataset(
    record: DatasetRecord
  ): Promise<{ record: DatasetRecord; deduplicated: boolean }> {
    try {
      const database = await this.open()
      const existing = (await requestResult(
        database
          .transaction("datasets", "readonly")
          .objectStore("datasets")
          .index("fingerprint")
          .get(record.fingerprint)
      )) as DatasetRecord | undefined
      if (existing) return { record: existing, deduplicated: true }
      const transaction = database.transaction("datasets", "readwrite")
      transaction.objectStore("datasets").add(record)
      await transactionDone(transaction)
      return { record, deduplicated: false }
    } catch (error) {
      throw storageError(error)
    }
  }

  async renameDataset(id: string, name: string): Promise<void> {
    const cleaned = name.trim()
    if (!cleaned) throw new Error("Dataset name cannot be empty.")
    await this.updateDataset(id, (record) => ({ ...record, name: cleaned }))
  }

  async replaceDataset(
    id: string,
    replacement: DatasetRecord
  ): Promise<DatasetRecord> {
    const current = await this.getRequiredDataset(id)
    const database = await this.open()
    const duplicate = (await requestResult(
      database
        .transaction("datasets", "readonly")
        .objectStore("datasets")
        .index("fingerprint")
        .get(replacement.fingerprint)
    )) as DatasetRecord | undefined
    if (duplicate && duplicate.id !== id)
      throw new Error(`This JSON is already saved as “${duplicate.name}”.`)
    const next = {
      ...replacement,
      id,
      name: current.name,
      lastOpenedCase: replacement.fixture.cases.some(
        (item) => item.case_id === current.lastOpenedCase
      )
        ? current.lastOpenedCase
        : replacement.fixture.cases[0].case_id,
    }
    const transaction = database.transaction("datasets", "readwrite")
    transaction.objectStore("datasets").put(next)
    await transactionDone(transaction)
    return next
  }

  async exportOriginal(id: string): Promise<string> {
    return (await this.getRequiredDataset(id)).rawJson
  }

  async deleteDataset(id: string): Promise<void> {
    try {
      const database = await this.open()
      const transaction = database.transaction(
        ["datasets", "controls"],
        "readwrite"
      )
      transaction.objectStore("datasets").delete(id)
      const cursor = transaction.objectStore("controls").openCursor()
      cursor.onsuccess = () => {
        const result = cursor.result
        if (!result) return
        if ((result.value as ControlRecord).datasetId === id) result.delete()
        result.continue()
      }
      await transactionDone(transaction)
    } catch (error) {
      throw storageError(error)
    }
  }

  async clearAll(): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(
      ["datasets", "controls"],
      "readwrite"
    )
    transaction.objectStore("datasets").clear()
    transaction.objectStore("controls").clear()
    await transactionDone(transaction)
  }

  async setControlState(
    datasetId: string,
    caseId: string,
    scope: string,
    value: unknown
  ): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction("controls", "readwrite")
    const record: ControlRecord = {
      key: `${datasetId}\u0000${caseId}\u0000${scope}`,
      datasetId,
      caseId,
      scope,
      value,
      updatedAt: new Date().toISOString(),
    }
    transaction.objectStore("controls").put(record)
    await transactionDone(transaction)
  }

  async getControlState<T>(
    datasetId: string,
    caseId: string,
    scope: string
  ): Promise<T | undefined> {
    const database = await this.open()
    const record = (await requestResult(
      database
        .transaction("controls", "readonly")
        .objectStore("controls")
        .get(`${datasetId}\u0000${caseId}\u0000${scope}`)
    )) as ControlRecord | undefined
    return record?.value as T | undefined
  }

  async setLastOpenedCase(datasetId: string, caseId: string): Promise<void> {
    const record = await this.getDataset(datasetId)
    if (record)
      await this.updateDataset(datasetId, (value) => ({
        ...value,
        lastOpenedCase: caseId,
      }))
  }

  async getLastOpenedCase(datasetId: string): Promise<string | undefined> {
    return (await this.getDataset(datasetId))?.lastOpenedCase
  }

  private async getRequiredDataset(id: string): Promise<DatasetRecord> {
    const record = await this.getDataset(id)
    if (!record) throw new Error("Saved dataset was not found.")
    return record
  }

  private async updateDataset(
    id: string,
    update: (record: DatasetRecord) => DatasetRecord
  ): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction("datasets", "readwrite")
    const store = transaction.objectStore("datasets")
    const record = (await requestResult(store.get(id))) as
      DatasetRecord | undefined
    if (!record) {
      transaction.abort()
      throw new Error("Saved dataset was not found.")
    }
    store.put(update(record))
    await transactionDone(transaction)
  }
}
