"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"

import publishedData from "@/public/data/P10_prepaid_meter_public.json"
import { forecastRunOut } from "@/src/domain/advice"
import { compareHabits } from "@/src/domain/comparison"
import { runDailyLedger } from "@/src/domain/ledger"
import { parseBdt } from "@/src/domain/money"
import { summarizeMonths } from "@/src/domain/summary"
import type { FixtureDocument, MeterCase } from "@/src/domain/types"
import { parseFixtureFile, validateFixture } from "@/src/data/fixture"

type FixtureContextValue = {
  fixture: FixtureDocument
  activeCase: MeterCase
  caseId: string
  ledger: ReturnType<typeof runDailyLedger>
  last: ReturnType<typeof runDailyLedger>[number]
  monthly: ReturnType<typeof summarizeMonths>
  runOut: ReturnType<typeof forecastRunOut>
  comparison: ReturnType<typeof compareHabits>
  alreadyRechargedThisMonth: boolean
  uploadError: string
  selectCase: (caseId: string | null) => void
  loadFixture: (
    file: File | undefined
  ) => Promise<{ ok: boolean; error?: string }>
  resetFixture: () => void
  clearUploadError: () => void
}

const publishedFixture = validateFixture(publishedData)
const FixtureContext = createContext<FixtureContextValue | null>(null)

export function FixtureProvider({ children }: { children: React.ReactNode }) {
  const [fixture, setFixture] = useState<FixtureDocument>(publishedFixture)
  const [caseId, setCaseId] = useState(publishedFixture.cases[0].case_id)
  const [uploadError, setUploadError] = useState("")
  const fixtureChangeId = useRef(0)
  const activeCase =
    fixture.cases.find((item) => item.case_id === caseId) ?? fixture.cases[0]

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

  const selectCase = (nextCaseId: string | null) => {
    if (
      nextCaseId &&
      fixture.cases.some((item) => item.case_id === nextCaseId)
    ) {
      setCaseId(nextCaseId)
    }
  }

  const loadFixture = async (file: File | undefined) => {
    if (!file) return { ok: false, error: "Choose a JSON fixture." }
    const requestId = ++fixtureChangeId.current
    try {
      const next = await parseFixtureFile(file)
      if (requestId !== fixtureChangeId.current)
        return {
          ok: false,
          error: "A newer fixture action replaced this upload.",
        }
      setFixture(next)
      setCaseId(next.cases[0].case_id)
      setUploadError("")
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The fixture could not be loaded."
      setUploadError(message)
      return { ok: false, error: message }
    }
  }

  const resetFixture = () => {
    fixtureChangeId.current += 1
    setFixture(publishedFixture)
    setCaseId(publishedFixture.cases[0].case_id)
    setUploadError("")
  }

  return (
    <FixtureContext.Provider
      value={{
        fixture,
        activeCase,
        caseId,
        uploadError,
        selectCase,
        loadFixture,
        resetFixture,
        clearUploadError: () => setUploadError(""),
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
