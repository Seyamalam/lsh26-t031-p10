"use client"

import { useMemo, useState } from "react"
import { PlugZap } from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
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
import { Separator } from "@/components/ui/separator"
import { simulateAppliance } from "@/src/domain/appliance"
import { addDays } from "@/src/domain/dates"
import { formatBdt } from "@/src/domain/money"

export function SimulatorView() {
  const { caseId } = useFixture()
  return <SimulatorPanel key={caseId} />
}

function SimulatorPanel() {
  const { activeCase, last } = useFixture()
  const [form, setForm] = useState({
    wattage: 1200,
    hours: 3,
    quantity: 1,
    days: 30,
    fixed: false,
  })
  const result = useMemo(
    () =>
      simulateAppliance({
        startDate: addDays(activeCase.today, 1),
        days: form.days,
        wattage: form.wattage,
        hoursPerDay: form.hours,
        quantity: form.quantity,
        baselineDailyUnits: activeCase.usual_daily_units,
        monthlyUnitsBefore: last.monthlyUnitsAfter,
        includeFirstRechargeCharges: form.fixed,
      }),
    [activeCase, last, form]
  )
  const set = (field: keyof typeof form, value: number | boolean) =>
    setForm((current) => ({ ...current, [field]: value }))
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Appliance simulator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slab-aware energy and VAT impact.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {activeCase.case_id}
        </Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Load settings</CardTitle>
            <CardDescription>
              Current usage: {activeCase.usual_daily_units} kWh/day.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <NumberField
              id="appliance-wattage"
              label="Wattage"
              value={form.wattage}
              min={1}
              onChange={(v) => set("wattage", v)}
            />
            <NumberField
              id="appliance-hours"
              label="Hours per day"
              value={form.hours}
              min={0}
              max={24}
              step={0.25}
              onChange={(v) => set("hours", v)}
            />
            <NumberField
              id="appliance-quantity"
              label="Quantity"
              value={form.quantity}
              min={1}
              step={1}
              onChange={(v) => set("quantity", Math.max(1, Math.round(v)))}
            />
            <NumberField
              id="projection-days"
              label="Projection days"
              value={form.days}
              min={1}
              max={366}
              step={1}
              onChange={(v) =>
                set("days", Math.min(366, Math.max(1, Math.round(v))))
              }
            />
            <label className="col-span-full flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={form.fixed}
                onChange={(event) => set("fixed", event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">
                  First recharge in month
                </span>
                <span className="block text-xs text-muted-foreground">
                  Include demand charge and meter rent.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Cost impact</CardTitle>
                <CardDescription>
                  Increment above the current daily-use baseline.
                </CardDescription>
              </div>
              <PlugZap className="size-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 md:grid-cols-[.8fr_1.2fr]">
            <div className="rounded-lg border bg-muted/35 p-5">
              <p className="text-xs text-muted-foreground">Total plan amount</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-teal-700 tabular-nums dark:text-teal-300">
                {formatBdt(result.totalPlanPoisha)}
              </p>
              <p className="mt-3 font-mono text-sm">
                {result.applianceMonthlyUnits.toFixed(2)} kWh ·{" "}
                {result.applianceDailyUnits.toFixed(3)} kWh/day
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <Row
                label="Incremental energy"
                value={result.incrementalEnergyPoisha}
              />
              <Row
                label="Incremental VAT"
                value={result.incrementalVatPoisha}
              />
              <Row label="Fixed charges" value={result.fixedChargesPoisha} />
              <Separator />
              <Row label="Total" value={result.totalPlanPoisha} strong />
              <p className="text-xs leading-5 text-muted-foreground">
                {result.fixedChargeReason}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Saving scenarios</CardTitle>
          <CardDescription>
            Lower appliance hours or duty cycle by the listed percentage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
          {result.scenarios.map((scenario) => (
            <div key={scenario.savingPercent} className="rounded-lg border p-4">
              <Badge variant="secondary">
                {scenario.savingPercent}% reduction
              </Badge>
              <p className="mt-3 font-mono text-2xl font-semibold">
                {formatBdt(scenario.totalSavedPoisha)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scenario.unitsSaved.toFixed(2)} kWh · energy{" "}
                {formatBdt(scenario.energySavedPoisha)} · VAT{" "}
                {formatBdt(scenario.vatSavedPoisha)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function NumberField({
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
function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${strong ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatBdt(value)}</span>
    </div>
  )
}
