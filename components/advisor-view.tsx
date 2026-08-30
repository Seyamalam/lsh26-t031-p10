"use client"

import { CalendarClock, CheckCircle2, Gauge } from "lucide-react"
import { useState } from "react"

import { useFixture } from "@/components/fixture-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { calculateRechargeNeed } from "@/src/domain/advice"
import { addDays, prettyDate } from "@/src/domain/dates"
import { formatBdt } from "@/src/domain/money"

export function AdvisorView() {
  const { activeCase, last, runOut, alreadyRechargedThisMonth } = useFixture()
  const [selection, setSelection] = useState({ caseId: activeCase.case_id, date: activeCase.target_date })
  const targetDate = selection.caseId === activeCase.case_id ? selection.date : activeCase.target_date
  const advice = calculateRechargeNeed(
    { date: activeCase.today, balancePoisha: last.closingBalancePoisha, monthlyUnits: last.monthlyUnitsAfter },
    targetDate,
    activeCase.usual_daily_units,
    alreadyRechargedThisMonth,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recharge advisor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run-out date and exact deposit requirement.</p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">{activeCase.case_id}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <Card id="run-out-answer" className="scroll-mt-20">
          <CardHeader>
            <CardDescription className="flex items-center gap-2"><CalendarClock className="size-4" /> Projected run-out</CardDescription>
            <CardTitle className="text-2xl">{runOut ? prettyDate(runOut.date) : "Beyond 10 years"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Days remaining" value={runOut ? String(runOut.days) : "3,650+"} />
              <Stat label="Usual use" value={`${activeCase.usual_daily_units} kWh/day`} />
              <Stat label="Current balance" value={formatBdt(last.closingBalancePoisha)} />
              <Stat label="Month units" value={`${last.monthlyUnitsAfter.toFixed(2)} kWh`} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Forecast starts after {activeCase.today}. Slab units reset on the first day of each calendar month.</p>
          </CardContent>
        </Card>

        <Card id="deposit-breakdown" className="scroll-mt-20">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>Deposit required today</CardTitle>
                <CardDescription>Calculated in integer poisha through the selected date.</CardDescription>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="target-date" className="text-xs">Last through</Label>
                <Input
                  id="target-date"
                  className="w-40 font-mono"
                  type="date"
                  min={addDays(activeCase.today, 1)}
                  value={targetDate}
                  onChange={(event) => event.target.value > activeCase.today && setSelection({ caseId: activeCase.case_id, date: event.target.value })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 pt-6 md:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border bg-muted/35 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recharge now</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-teal-700 dark:text-teal-300">{formatBdt(advice.rechargeNeededPoisha)}</p>
              <p className="mt-3 text-sm text-muted-foreground">{advice.projectedDays} days · {advice.projectedUnits.toFixed(2)} projected kWh</p>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <Gauge aria-hidden="true" className="size-4" /> Through {prettyDate(targetDate)}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Breakdown label="Energy at first-slab rate" value={advice.baselineEnergyPoisha} />
              <Breakdown label="Higher-slab increment" value={advice.higherSlabPoisha} />
              <Breakdown label="Energy subtotal" value={advice.energyPoisha} strong />
              <Breakdown label="VAT on energy" value={advice.vatPoisha} />
              <Breakdown label="Applicable fixed charges" value={advice.fixedPoisha} />
              <Separator className="my-3" />
              <Breakdown label="Current balance credit" value={-advice.balanceCreditPoisha} muted />
              <Breakdown label="Recharge required" value={advice.rechargeNeededPoisha} strong />
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-teal-500/30 bg-teal-500/5">
        <CheckCircle2 className="text-teal-600" />
        <AlertTitle>Fixed-charge rule applied</AlertTitle>
        <AlertDescription>
          {alreadyRechargedThisMonth
            ? "A recharge already occurred this month, so this deposit adds no demand charge or meter rent."
            : "This would be the first recharge this month; demand charge and meter rent are included only when a deposit is required."}
        </AlertDescription>
      </Alert>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/50 p-3"><p className="font-mono text-sm font-semibold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{label}</p></div>
}

function Breakdown({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  const formatted = value < 0 ? `−${formatBdt(Math.abs(value))}` : formatBdt(value)
  return <div className={`flex items-center justify-between gap-4 ${muted ? "text-muted-foreground" : ""} ${strong ? "font-semibold" : ""}`}><span>{label}</span><span className="font-mono tabular-nums">{formatted}</span></div>
}
