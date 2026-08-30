"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import publishedData from "@/public/data/P10_prepaid_meter_public.json"
import { forecastRunOut } from "@/src/domain/advice"
import { compareHabits } from "@/src/domain/comparison"
import type { ForecastBundle } from "@/src/domain/forecast"
import { forecastConsumption } from "@/src/domain/forecast"
import { runDailyLedger } from "@/src/domain/ledger"
import { parseBdt } from "@/src/domain/money"
import { summarizeMonths } from "@/src/domain/summary"
import type { FixtureDocument, MeterCase } from "@/src/domain/types"
import { readFixtureUpload, validateFixture } from "@/src/data/fixture"
import {
  createDatasetRecord,
  type DatasetSummary,
  WorkspaceCatalog,
} from "@/src/workspace/catalog"
import {
  FORECAST_ENGINE_VERSION,
  forecastIdentity,
  ForecastModelCache,
  keyedForecastValue,
  LatestRequestGuard,
  LruCache,
  MemoryControlStore,
  readLastDatasetId,
  routeControlRead,
  routeControlWrite,
  writeLastDatasetId,
} from "@/src/workspace/runtime"
import { forecastAccelerated } from "@/src/workspace/workers"

export const BUNDLED_DATASET_ID = "bundled:p10-public"
const BUNDLED_FINGERPRINT = "bundled:p10-public:2.2"
export type ImportMode = "once" | "save"

type FixtureContextValue = {
  fixture: FixtureDocument
  fixtureRevision: number
  activeCase: MeterCase
  caseId: string
  datasetId: string
  datasetName: string
  datasetKind: "bundled" | "saved" | "temporary"
  datasetFingerprint: string
  savedDatasets: DatasetSummary[]
  workspaceReady: boolean
  workspaceError: string
  ledger: ReturnType<typeof runDailyLedger>
  last: ReturnType<typeof runDailyLedger>[number]
  monthly: ReturnType<typeof summarizeMonths>
  runOut: ReturnType<typeof forecastRunOut>
  comparison: ReturnType<typeof compareHabits>
  alreadyRechargedThisMonth: boolean
  forecast: ForecastBundle | null
  forecastLoading: boolean
  forecastWorkerUsed: boolean
  uploadError: string
  selectCase: (caseId: string | null) => void
  selectDataset: (datasetId: string | null) => Promise<void>
  loadFixture: (
    file: File | undefined,
    mode?: ImportMode,
    name?: string
  ) => Promise<{ ok: boolean; error?: string; deduplicated?: boolean }>
  resetFixture: () => void
  clearUploadError: () => void
  renameDataset: (id: string, name: string) => Promise<void>
  replaceDataset: (id: string, file: File) => Promise<void>
  deleteDataset: (id: string) => Promise<void>
  clearSavedDatasets: () => Promise<void>
  exportDataset: (id: string) => Promise<string>
  getControlState: <T>(scope: string) => Promise<T | undefined>
  setControlState: (scope: string, value: unknown) => Promise<void>
}

const publishedFixture = validateFixture(publishedData)
const FixtureContext = createContext<FixtureContextValue | null>(null)
const sharedForecastCache = new ForecastModelCache<ForecastBundle>()

export function FixtureProvider({ children }: { children: React.ReactNode }) {
  const [fixture, setFixture] = useState<FixtureDocument>(publishedFixture)
  const [fixtureRevision, setFixtureRevision] = useState(0)
  const [caseId, setCaseId] = useState(publishedFixture.cases[0].case_id)
  const [datasetId, setDatasetId] = useState(BUNDLED_DATASET_ID)
  const [datasetName, setDatasetName] = useState("Bundled public fixture")
  const [datasetKind, setDatasetKind] = useState<
    "bundled" | "saved" | "temporary"
  >("bundled")
  const [datasetFingerprint, setDatasetFingerprint] =
    useState(BUNDLED_FINGERPRINT)
  const [savedDatasets, setSavedDatasets] = useState<DatasetSummary[]>([])
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [workspaceError, setWorkspaceError] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [workerForecast, setWorkerForecast] = useState<{
    key: string
    value: ForecastBundle
  } | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastWorkerUsed, setForecastWorkerUsed] = useState(false)
  const activationGuard = useRef(new LatestRequestGuard())
  const catalogRef = useRef<WorkspaceCatalog | null>(null)
  const fixtureCache = useRef(new LruCache<string, FixtureDocument>(4))
  const temporaryControls = useRef(new MemoryControlStore())
  const activeCase =
    fixture.cases.find((item) => item.case_id === caseId) ?? fixture.cases[0]

  const activate = useCallback(
    (input: {
      id: string
      name: string
      kind: "bundled" | "saved" | "temporary"
      fingerprint: string
      fixture: FixtureDocument
      requestedCase?: string
    }) => {
      const nextCase =
        input.requestedCase &&
        input.fixture.cases.some((item) => item.case_id === input.requestedCase)
          ? input.requestedCase
          : input.fixture.cases[0].case_id
      setFixture(input.fixture)
      setCaseId(nextCase)
      setDatasetId(input.id)
      setDatasetName(input.name)
      setDatasetKind(input.kind)
      setDatasetFingerprint(input.fingerprint)
      setFixtureRevision((value) => value + 1)
      setUploadError("")
      fixtureCache.current.set(input.id, input.fixture)
    },
    []
  )

  const refreshDatasets = useCallback(async () => {
    if (catalogRef.current)
      setSavedDatasets(await catalogRef.current.listDatasets())
  }, [])

  useEffect(() => {
    let cancelled = false
    const requestId = activationGuard.current.begin()
    void (async () => {
      try {
        const catalog = new WorkspaceCatalog()
        catalogRef.current = catalog
        const datasets = await catalog.listDatasets()
        if (cancelled) return
        setSavedDatasets(datasets)
        const restoredId = readLastDatasetId(window.localStorage)
        const restored = restoredId
          ? await catalog.getDataset(restoredId)
          : undefined
        if (cancelled || !activationGuard.current.isCurrent(requestId)) return
        if (restored) {
          activate({
            id: restored.id,
            name: restored.name,
            kind: "saved",
            fingerprint: restored.fingerprint,
            fixture: restored.fixture,
            requestedCase: restored.lastOpenedCase,
          })
        } else if (restoredId) writeLastDatasetId(window.localStorage, null)
      } catch (error) {
        if (!cancelled && activationGuard.current.isCurrent(requestId))
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Device workspace is unavailable."
          )
      } finally {
        if (!cancelled) setWorkspaceReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activate])

  const computed = useMemo(() => {
    const ledger = runDailyLedger(
      parseBdt(activeCase.opening_balance_bdt),
      activeCase.days,
      activeCase.recharges
    )
    const last = ledger.at(-1)!
    const state = {
      date: activeCase.today,
      balancePoisha: last.closingBalancePoisha,
      monthlyUnits: last.monthlyUnitsAfter,
    }
    return {
      ledger,
      last,
      monthly: summarizeMonths(activeCase),
      runOut: forecastRunOut(state, activeCase.usual_daily_units),
      comparison: compareHabits(activeCase.days, activeCase.comparison),
      alreadyRechargedThisMonth: activeCase.recharges.some((recharge) =>
        recharge.date.startsWith(activeCase.today.slice(0, 7))
      ),
    }
  }, [activeCase])

  const synchronousForecast = useMemo(() => {
    if (activeCase.days.length > 1000) return null
    const cached = sharedForecastCache.get(
      datasetFingerprint,
      activeCase.case_id,
      FORECAST_ENGINE_VERSION
    )
    if (cached) return cached
    const result = forecastConsumption(activeCase.days, 30)
    sharedForecastCache.set(
      datasetFingerprint,
      activeCase.case_id,
      FORECAST_ENGINE_VERSION,
      result
    )
    return result
  }, [activeCase, datasetFingerprint])

  const currentForecastKey = forecastIdentity(
    datasetFingerprint,
    activeCase.case_id,
    FORECAST_ENGINE_VERSION
  )

  useEffect(() => {
    if (synchronousForecast) return
    let cancelled = false
    const requestKey = currentForecastKey
    void (async () => {
      await Promise.resolve()
      if (!cancelled) setForecastLoading(true)
      const cached = sharedForecastCache.get(
        datasetFingerprint,
        activeCase.case_id,
        FORECAST_ENGINE_VERSION
      )
      if (cached) {
        if (!cancelled) {
          setWorkerForecast({ key: requestKey, value: cached })
          setForecastLoading(false)
          setForecastWorkerUsed(false)
        }
        return
      }
      try {
        const { forecast, usedWorker } = await forecastAccelerated(
          activeCase.days
        )
        if (cancelled) return
        sharedForecastCache.set(
          datasetFingerprint,
          activeCase.case_id,
          FORECAST_ENGINE_VERSION,
          forecast
        )
        setWorkerForecast({ key: requestKey, value: forecast })
        setForecastWorkerUsed(usedWorker)
        setForecastLoading(false)
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error ? error.message : "Forecast failed."
          )
          setForecastLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeCase,
    currentForecastKey,
    datasetFingerprint,
    synchronousForecast,
  ])

  const selectCase = (nextCaseId: string | null) => {
    if (
      !nextCaseId ||
      !fixture.cases.some((item) => item.case_id === nextCaseId)
    )
      return
    setCaseId(nextCaseId)
    setFixtureRevision((value) => value + 1)
    if (datasetKind === "saved") {
      void catalogRef.current
        ?.setLastOpenedCase(datasetId, nextCaseId)
        .then(refreshDatasets)
        .catch(() => undefined)
    }
  }

  const selectDataset = async (nextDatasetId: string | null) => {
    if (!nextDatasetId) return
    const requestId = activationGuard.current.begin()
    if (nextDatasetId === datasetId) return
    if (nextDatasetId === BUNDLED_DATASET_ID) {
      activate({
        id: BUNDLED_DATASET_ID,
        name: "Bundled public fixture",
        kind: "bundled",
        fingerprint: BUNDLED_FINGERPRINT,
        fixture: publishedFixture,
      })
      writeLastDatasetId(window.localStorage, null)
      return
    }
    const summary = savedDatasets.find((item) => item.id === nextDatasetId)
    const cached = fixtureCache.current.get(nextDatasetId)
    const record =
      cached && summary
        ? { ...summary, fixture: cached }
        : await catalogRef.current?.getDataset(nextDatasetId)
    if (!activationGuard.current.isCurrent(requestId)) return
    if (!record) {
      setWorkspaceError(
        "Saved dataset was not found. It may have been removed in another tab."
      )
      await refreshDatasets()
      return
    }
    activate({
      id: record.id,
      name: record.name,
      kind: "saved",
      fingerprint: record.fingerprint,
      fixture: record.fixture,
      requestedCase: record.lastOpenedCase,
    })
    writeLastDatasetId(window.localStorage, record.id)
  }

  const loadFixture = async (
    file: File | undefined,
    mode: ImportMode = "once",
    name?: string
  ) => {
    if (!file) return { ok: false, error: "Choose a JSON fixture." }
    const requestId = activationGuard.current.begin()
    try {
      const parsed = await readFixtureUpload(file)
      if (!activationGuard.current.isCurrent(requestId))
        return {
          ok: false,
          error: "A newer fixture action replaced this upload.",
        }
      const candidate = await createDatasetRecord({
        name: name ?? file.name.replace(/\.json$/i, ""),
        sourceFilename: file.name,
        rawJson: parsed.rawJson,
        fixture: parsed.fixture,
      })
      if (!activationGuard.current.isCurrent(requestId))
        return {
          ok: false,
          error: "A newer fixture action replaced this upload.",
        }
      if (mode === "save") {
        if (!catalogRef.current)
          throw new Error(
            "Device workspace is still starting. Try again in a moment."
          )
        const result = await catalogRef.current.saveDataset(candidate)
        await refreshDatasets()
        if (!activationGuard.current.isCurrent(requestId))
          return {
            ok: false,
            error: "A newer fixture action replaced this upload.",
          }
        activate({
          id: result.record.id,
          name: result.record.name,
          kind: "saved",
          fingerprint: result.record.fingerprint,
          fixture: result.record.fixture,
          requestedCase: result.record.lastOpenedCase,
        })
        writeLastDatasetId(window.localStorage, result.record.id)
        return { ok: true, deduplicated: result.deduplicated }
      }
      activate({
        id: `once:${candidate.id}`,
        name: candidate.name,
        kind: "temporary",
        fingerprint: candidate.fingerprint,
        fixture: candidate.fixture,
      })
      writeLastDatasetId(window.localStorage, null)
      return { ok: true }
    } catch (error) {
      if (!activationGuard.current.isCurrent(requestId))
        return {
          ok: false,
          error: "A newer fixture action replaced this upload.",
        }
      const message =
        error instanceof Error
          ? error.message
          : "The fixture could not be loaded."
      setUploadError(message)
      return { ok: false, error: message }
    }
  }

  const resetFixture = () => {
    activationGuard.current.invalidate()
    activate({
      id: BUNDLED_DATASET_ID,
      name: "Bundled public fixture",
      kind: "bundled",
      fingerprint: BUNDLED_FINGERPRINT,
      fixture: publishedFixture,
    })
    if (typeof window !== "undefined")
      writeLastDatasetId(window.localStorage, null)
  }

  const renameDataset = async (id: string, name: string) => {
    await catalogRef.current?.renameDataset(id, name)
    await refreshDatasets()
    if (id === datasetId) setDatasetName(name.trim())
  }
  const replaceDataset = async (id: string, file: File) => {
    if (!catalogRef.current) throw new Error("Device workspace is unavailable.")
    const previous = savedDatasets.find((item) => item.id === id)
    const parsed = await readFixtureUpload(file)
    const candidate = await createDatasetRecord({
      name: file.name,
      sourceFilename: file.name,
      rawJson: parsed.rawJson,
      fixture: parsed.fixture,
    })
    const replacement = await catalogRef.current.replaceDataset(id, candidate)
    fixtureCache.current.delete(id)
    if (previous) sharedForecastCache.clearFingerprint(previous.fingerprint)
    await refreshDatasets()
    if (id === datasetId)
      activate({
        id,
        name: replacement.name,
        kind: "saved",
        fingerprint: replacement.fingerprint,
        fixture: replacement.fixture,
        requestedCase: replacement.lastOpenedCase,
      })
  }
  const deleteDataset = async (id: string) => {
    if (!catalogRef.current) return
    if (id === datasetId) resetFixture()
    await catalogRef.current.deleteDataset(id)
    fixtureCache.current.delete(id)
    await refreshDatasets()
  }
  const clearSavedDatasets = async () => {
    if (!catalogRef.current) return
    if (datasetKind === "saved") resetFixture()
    await catalogRef.current.clearAll()
    fixtureCache.current.clear()
    setSavedDatasets([])
  }
  const exportDataset = async (id: string) => {
    if (!catalogRef.current) throw new Error("Device workspace is unavailable.")
    return catalogRef.current.exportOriginal(id)
  }
  const getControlState = async <T,>(scope: string) => {
    try {
      return await routeControlRead<T>(
        datasetKind,
        datasetId,
        caseId,
        scope,
        temporaryControls.current,
        {
          get: () =>
            catalogRef.current?.getControlState<T>(datasetId, caseId, scope) ??
            Promise.resolve(undefined),
          set: () => Promise.resolve(),
        }
      )
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Saved controls are unavailable."
      )
      return undefined
    }
  }
  const setControlState = async (scope: string, value: unknown) => {
    try {
      await routeControlWrite(
        datasetKind,
        datasetId,
        caseId,
        scope,
        value,
        temporaryControls.current,
        {
          get: () => Promise.resolve(undefined),
          set: (next) =>
            catalogRef.current?.setControlState(
              datasetId,
              caseId,
              scope,
              next
            ) ?? Promise.resolve(),
        }
      )
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Could not save controls."
      )
    }
  }

  return (
    <FixtureContext.Provider
      value={{
        fixture,
        fixtureRevision,
        activeCase,
        caseId,
        datasetId,
        datasetName,
        datasetKind,
        datasetFingerprint,
        savedDatasets,
        workspaceReady,
        workspaceError,
        uploadError,
        selectCase,
        selectDataset,
        loadFixture,
        resetFixture,
        clearUploadError: () => setUploadError(""),
        renameDataset,
        replaceDataset,
        deleteDataset,
        clearSavedDatasets,
        exportDataset,
        getControlState,
        setControlState,
        forecast:
          synchronousForecast ??
          keyedForecastValue(workerForecast, currentForecastKey) ??
          null,
        forecastLoading: synchronousForecast ? false : forecastLoading,
        forecastWorkerUsed: synchronousForecast ? false : forecastWorkerUsed,
        ...computed,
      }}
    >
      {children}
    </FixtureContext.Provider>
  )
}

export function useFixture() {
  const context = useContext(FixtureContext)
  if (!context)
    throw new Error("useFixture must be used inside FixtureProvider.")
  return context
}

export function usePersistedControlState<T>(
  scope: string,
  defaults: T
): [T, (value: T | ((current: T) => T)) => void, boolean] {
  const { datasetId, caseId, getControlState, setControlState } = useFixture()
  const [value, setValue] = useState(defaults)
  const [ready, setReady] = useState(false)
  const key = `${datasetId}:${caseId}:${scope}`
  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setValue(defaults)
      setReady(false)
      const stored = await getControlState<T>(scope)
      if (!cancelled) {
        if (stored !== undefined) setValue(stored)
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (next: T | ((current: T) => T)) =>
    setValue((current) => {
      const resolved =
        typeof next === "function" ? (next as (current: T) => T)(current) : next
      void setControlState(scope, resolved)
      return resolved
    })
  return [value, update, ready]
}
