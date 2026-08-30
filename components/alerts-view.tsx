"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  detectConsumptionAnomalies,
  evaluateConsumptionAlerts,
} from "@/src/domain/insights"
import { formatBdt } from "@/src/domain/money"

export function AlertsView() {
  const { caseId } = useFixture()
  return <AlertsPanel key={caseId} />
}

function AlertsPanel() {
  const { activeCase, ledger, runOut } = useFixture()
  const [budgetBdt, setBudgetBdt] = useState(3000)
  const [budgetWarning, setBudgetWarning] = useState(80)
  const [runOutWarning, setRunOutWarning] = useState(7)
  const [sensitivity, setSensitivity] = useState(2.5)
  const currentMonth = activeCase.today.slice(0, 7)
  const currentMonthCost = ledger
    .filter((row) => row.date.startsWith(currentMonth))
    .reduce(
      (sum, row) =>
        sum + row.energyCostPoisha + row.vatPoisha + row.fixedChargesPoisha,
      0
    )
  const alerts = evaluateConsumptionAlerts({
    currentMonthCostPoisha: currentMonthCost,
    monthlyBudgetPoisha: Math.max(1, Math.round(budgetBdt * 100)),
    budgetWarningPercent: Math.min(100, Math.max(1, budgetWarning)),
    runOutDays: runOut?.days ?? null,
    runOutWarningDays: Math.max(1, Math.round(runOutWarning)),
  })
  const anomalies = useMemo(
    () =>
      detectConsumptionAnomalies(activeCase.days, {
        sensitivity: Math.max(1, sensitivity),
      }),
    [activeCase, sensitivity]
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Budget, run-out, and usage exceptions.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {activeCase.case_id}
        </Badge>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Thresholds</CardTitle>
          <CardDescription>
            Settings reset when the fixture case changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            id="monthly-budget"
            label="Monthly budget (BDT)"
            value={budgetBdt}
            min={1}
            onChange={setBudgetBdt}
          />
          <Field
            id="budget-warning"
            label="Budget warning (%)"
            value={budgetWarning}
            min={1}
            max={100}
            onChange={setBudgetWarning}
          />
          <Field
            id="runout-warning"
            label="Run-out warning (days)"
            value={runOutWarning}
            min={1}
            onChange={setRunOutWarning}
          />
          <Field
            id="anomaly-threshold"
            label="Anomaly score threshold"
            value={sensitivity}
            min={1}
            step={0.1}
            onChange={setSensitivity}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusAlert
          title="Monthly budget"
          status={alerts.budget.status}
          reason={alerts.budget.reason}
          detail={`${formatBdt(currentMonthCost)} consumed · ${formatBdt(alerts.budget.remainingPoisha)} remaining`}
        />
        <StatusAlert
          title="Balance run-out"
          status={alerts.runOut.status}
          reason={alerts.runOut.reason}
          detail={runOut ? runOut.date : "No date within 10 years"}
        />
      </div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Consumption anomalies</CardTitle>
              <CardDescription>
                Score = |reading - mean| / max(standard deviation, 10% of mean,
                0.5).
              </CardDescription>
            </div>
            <Badge variant={anomalies.length ? "destructive" : "secondary"}>
              {anomalies.length} found
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y px-0">
          {anomalies.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No readings cross the configured threshold.
            </p>
          ) : (
            anomalies
              .slice(-12)
              .reverse()
              .map((item) => (
                <div
                  key={item.date}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-[110px_90px_1fr] sm:items-center"
                >
                  <span className="font-mono text-xs">{item.date}</span>
                  <Badge
                    variant={
                      item.direction === "high" ? "destructive" : "secondary"
                    }
                  >
                    {item.direction} · score {item.score.toFixed(2)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.reason}
                  </span>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        {...props}
      />
    </div>
  )
}

function StatusAlert({
  title,
  status,
  reason,
  detail,
}: {
  title: string
  status: "ok" | "warning" | "critical"
  reason: string
  detail: string
}) {
  const Icon = status === "ok" ? CheckCircle2 : AlertTriangle
  return (
    <Alert
      variant={status === "critical" ? "destructive" : "default"}
      className={
        status === "warning"
          ? "border-amber-500/40 bg-amber-500/5"
          : status === "ok"
            ? "border-teal-500/30 bg-teal-500/5"
            : ""
      }
    >
      <Icon />
      <AlertTitle className="flex items-center justify-between gap-2">
        {title}
        <Badge variant="outline">{status}</Badge>
      </AlertTitle>
      <AlertDescription>
        {reason}
        <span className="mt-2 block font-mono text-xs text-foreground">
          {detail}
        </span>
      </AlertDescription>
    </Alert>
  )
}
