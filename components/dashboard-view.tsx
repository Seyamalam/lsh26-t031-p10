"use client"

import { BatteryMedium, CalendarClock, CircleDollarSign, Zap } from "lucide-react"

import { BalanceHistoryChart, MonthlyConsumptionChart } from "@/components/analysis-charts"
import { useFixture } from "@/components/fixture-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { prettyDate, prettyMonth } from "@/src/domain/dates"
import { formatBdt } from "@/src/domain/money"
import { SLABS } from "@/src/domain/tariff"

export function DashboardView() {
  const { activeCase, caseId, ledger, last, monthly, runOut } = useFixture()
  if (!ledger.length) return <EmptyState />
  const slab = SLABS.find((item) => item.to === null || last.monthlyUnitsAfter <= item.to) ?? SLABS.at(-1)!
  const slabStart = slab.from - 1
  const slabSize = slab.to ? slab.to - slabStart : Math.max(last.monthlyUnitsAfter - slabStart, 1)
  const slabProgress = Math.min(100, ((last.monthlyUnitsAfter - slabStart) / slabSize) * 100)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-semibold tracking-tight">Household snapshot</h2><p className="mt-1 text-sm text-muted-foreground">{activeCase.days[0].date} to {activeCase.today}</p></div>
        <Badge variant="outline" className="w-fit font-mono">{caseId} · {activeCase.days.length} readings</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Closing balance" value={formatBdt(last.closingBalancePoisha)} note={`After ${prettyDate(activeCase.today)}`} alert={last.closingBalancePoisha <= 0} />
        <Metric icon={CalendarClock} label="Run-out date" value={runOut ? prettyDate(runOut.date) : "Beyond horizon"} note={runOut ? `${runOut.days} usage days` : "10+ years"} alert={runOut?.days === 0} />
        <Metric icon={Zap} label="Month-to-date" value={`${last.monthlyUnitsAfter} units`} note={`${(slab.ratePoisha / 100).toFixed(2)} BDT current rate`} />
        <Metric icon={BatteryMedium} label="Recharge events" value={String(activeCase.recharges.length)} note={`${activeCase.usual_daily_units} usual units/day`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Balance history</CardTitle><CardDescription>Daily closing balance; orange markers are recharge days.</CardDescription><CardAction><Badge variant="outline">{activeCase.recharges.length} markers</Badge></CardAction></CardHeader>
          <CardContent><BalanceHistoryChart rows={ledger} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Monthly consumption</CardTitle><CardDescription>Calendar-month unit totals.</CardDescription></CardHeader>
          <CardContent><MonthlyConsumptionChart months={monthly.months} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Current slab</CardTitle><CardDescription>{slab.to ? `${slab.from}–${slab.to} units` : `${slab.from}+ units`} at {(slab.ratePoisha / 100).toFixed(2)} BDT/unit</CardDescription><CardAction><span className="font-mono text-sm font-semibold">{Math.round(slabProgress)}%</span></CardAction></CardHeader>
          <CardContent><Progress value={slabProgress} />{slab.to && <p className="mt-2 text-xs text-muted-foreground">{Math.max(0, slab.to - last.monthlyUnitsAfter)} units before the next slab.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Required history checks</CardTitle><CardDescription>Fixture coverage for requirement 1.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <HistoryStat label="Light" month={monthly.light.month} value={`${monthly.light.units}u`} />
            <HistoryStat label="Heavy" month={monthly.heavy.month} value={`${monthly.heavy.units}u`} />
            <HistoryStat label="Late recharge" month={monthly.late?.month ?? monthly.months.at(-1)!.month} value={monthly.late ? formatBdt(monthly.late.lateRechargePoisha) : "None"} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, note, alert }: { icon: typeof Zap; label: string; value: string; note: string; alert?: boolean }) {
  return <Card size="sm"><CardHeader><div className="mb-2 flex size-8 items-center justify-center rounded-md bg-muted"><Icon className="size-4 text-muted-foreground" /></div><CardDescription>{label}</CardDescription><CardTitle className={`font-mono text-xl ${alert ? "text-destructive" : ""}`}>{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{note}</CardContent></Card>
}

function HistoryStat({ label, month, value }: { label: string; month: string; value: string }) {
  return <div className="min-w-0"><p className="truncate font-mono text-sm font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{prettyMonth(month)}</p></div>
}

function EmptyState() {
  return <Card><CardHeader><CardTitle>No readings</CardTitle><CardDescription>Load a valid P10 fixture to view the dashboard.</CardDescription></CardHeader></Card>
}
