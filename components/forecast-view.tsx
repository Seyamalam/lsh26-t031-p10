"use client"

import { CheckCircle2 } from "lucide-react"

import { ForecastChart } from "@/components/analysis-charts"
import { useFixture } from "@/components/fixture-provider"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ForecastView() {
  const { activeCase, forecast, forecastLoading, forecastWorkerUsed } =
    useFixture()
  if (!forecast)
    return (
      <div className="space-y-4" aria-busy={forecastLoading}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    )
  const { evaluation } = forecast
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Demand forecast
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            30-day backtest and forward estimate.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {activeCase.case_id} · {forecastWorkerUsed ? "worker" : "sync"}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Selected model"
          value={forecast.explanation.model}
          accent
        />
        <Metric
          label="Regression RMSE"
          value={`${evaluation.regression.rmse.toFixed(3)} kWh`}
        />
        <Metric
          label="7-day mean RMSE"
          value={`${evaluation.baseline.rmse.toFixed(3)} kWh`}
        />
        <Metric label="Holdout" value={`${evaluation.holdoutDays} days`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Daily units</CardTitle>
            <CardDescription>
              Selected forecast with an RMSE uncertainty band.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ForecastChart points={forecast.points} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Model evidence</CardTitle>
            <CardDescription>
              Deterministic TypeScript calculation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Evidence label="Selection" value={evaluation.reason} />
            <Evidence label="Features" value={forecast.explanation.features} />
            <Evidence
              label="Uncertainty"
              value={forecast.explanation.confidence}
            />
            <Evidence
              label="Metrics"
              value="MAE = mean(|actual - predicted|). RMSE = sqrt(mean(error²))."
            />
            <div className="flex items-center gap-2 rounded-md border border-teal-500/30 bg-teal-500/5 p-3 text-xs">
              <CheckCircle2 className="size-4 shrink-0 text-teal-600" /> Better
              model selected automatically by holdout RMSE.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={`mt-1 font-mono text-base font-semibold tabular-nums ${accent ? "text-teal-700 dark:text-teal-300" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 leading-5">{value}</p>
    </div>
  )
}
