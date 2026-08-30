"use client"

import { CheckCircle2, Download, Equal, TriangleAlert } from "lucide-react"

import { ComparisonCostChart } from "@/components/analysis-charts"
import { useFixture } from "@/components/fixture-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { downloadTextFile } from "@/lib/download"
import { prettyMonth } from "@/src/domain/dates"
import { comparisonCsv } from "@/src/domain/export"
import { formatBdt } from "@/src/domain/money"
import type { CostTotals } from "@/src/domain/types"

export function ComparisonView() {
  const { activeCase, comparison } = useFixture()
  const result = comparison.cheaper === "equal"
    ? "Equal consumed cost"
    : `${comparison.cheaper === "low" ? "Low-balance" : "Monthly"} costs ${formatBdt(comparison.differencePoisha)} less`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recharge habit comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">Same consumption and calendar-month slab counter.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">{comparison.days} daily readings</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTextFile(
              `${activeCase.case_id}-habit-comparison.csv`,
              comparisonCsv({ caseId: activeCase.case_id, months: activeCase.comparison.months, ...comparison }),
            )}
          >
            <Download aria-hidden="true" /> Export CSV
          </Button>
        </div>
      </div>

      <Alert className={comparison.invariant ? "border-teal-500/30 bg-teal-500/5" : undefined} variant={comparison.invariant ? "default" : "destructive"}>
        {comparison.invariant ? <CheckCircle2 className="text-teal-600" /> : <TriangleAlert />}
        <AlertTitle>{comparison.invariant ? "Invariant passed: energy and VAT match exactly" : "Invariant failed"}</AlertTitle>
        <AlertDescription>Recharge timing cannot change energy slab cost. Any difference below comes only from monthly first-recharge fixed charges.</AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Consumed cost</CardTitle>
            <CardDescription>{activeCase.comparison.months.map(prettyMonth).join(" · ")}</CardDescription>
          </CardHeader>
          <CardContent><ComparisonCostChart low={comparison.lowBalance} monthly={comparison.monthly} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Decision</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl"><Equal className="size-5 text-teal-600" /> {result}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PolicyRow label="Energy cost" low={comparison.lowBalance.energyPoisha} monthly={comparison.monthly.energyPoisha} />
            <PolicyRow label="VAT" low={comparison.lowBalance.vatPoisha} monthly={comparison.monthly.vatPoisha} />
            <PolicyRow label="Fixed charges" low={comparison.lowBalance.fixedPoisha} monthly={comparison.monthly.fixedPoisha} />
            <Separator />
            <PolicyRow label="Consumed cost" low={comparison.lowBalance.costPoisha} monthly={comparison.monthly.costPoisha} strong />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HabitCard
          name="Low-balance habit"
          detail={`Recharge ${activeCase.comparison.low_amount_bdt} BDT when opening balance is below ${activeCase.comparison.low_threshold_bdt} BDT`}
          values={comparison.lowBalance}
        />
        <HabitCard
          name="Monthly habit"
          detail={`Recharge ${activeCase.comparison.monthly_amount_bdt} BDT on the first day of each month`}
          values={comparison.monthly}
        />
      </div>
      <p className="text-xs text-muted-foreground">Deposits are cash added, not cost. Cost is energy + VAT + applicable monthly fixed charges.</p>
    </div>
  )
}

function PolicyRow({ label, low, monthly, strong }: { label: string; low: number; monthly: number; strong?: boolean }) {
  return <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 ${strong ? "font-semibold" : ""}`}><span>{label}</span><span className="w-28 text-right font-mono tabular-nums">{formatBdt(low)}</span><span className="w-28 text-right font-mono tabular-nums">{formatBdt(monthly)}</span></div>
}

function HabitCard({ name, detail, values }: { name: string; detail: string; values: CostTotals }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{name}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Metric label="Consumed cost" value={values.costPoisha} />
        <Metric label="Deposited" value={values.depositsPoisha} />
        <Metric label="End balance" value={values.endingBalancePoisha} />
        <Metric label="Recharges" value={values.rechargeCount} money={false} />
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, money = true }: { label: string; value: number; money?: boolean }) {
  return <div><p className="font-mono text-base font-semibold tabular-nums">{money ? formatBdt(value) : value}</p><p className="mt-1 text-[11px] text-muted-foreground">{label}</p></div>
}
