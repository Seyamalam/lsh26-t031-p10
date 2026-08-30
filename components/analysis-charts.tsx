"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { prettyMonth } from "@/src/domain/dates"
import type { CostTotals, DailyLedgerRow } from "@/src/domain/types"
import type { ForecastPoint } from "@/src/domain/forecast"

const forecastConfig = {
  predictedUnits: { label: "Forecast", color: "var(--chart-1)" },
  interval: { label: "RMSE band", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const data = points.map((point) => ({
    ...point,
    interval: [point.lowerUnits, point.upperUnits],
  }))
  return (
    <ChartContainer
      config={forecastConfig}
      className="aspect-auto h-[300px] w-full"
    >
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={52}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis tickLine={false} axisLine={false} width={42} unit=" kWh" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="interval"
          stroke="none"
          fill="var(--color-interval)"
          fillOpacity={0.14}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="predictedUnits"
          stroke="var(--color-predictedUnits)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const balanceConfig = {
  balance: { label: "Balance", color: "var(--chart-1)" },
  recharge: { label: "Recharge", color: "var(--chart-2)" },
} satisfies ChartConfig

export function BalanceHistoryChart({ rows }: { rows: DailyLedgerRow[] }) {
  const data = rows.map((row) => ({
    date: row.date,
    balance: row.closingBalancePoisha / 100,
    recharge: row.rechargePoisha / 100,
  }))
  const rechargeData = data.filter((item) => item.recharge > 0)
  return (
    <ChartContainer
      config={balanceConfig}
      className="aspect-auto h-[280px] w-full"
    >
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={56}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(value: number) => `৳${Math.round(value)}`}
        />
        <ReferenceLine
          y={0}
          stroke="var(--destructive)"
          strokeDasharray="4 4"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-mono font-medium">
                    ৳
                    {Number(value).toLocaleString("en-BD", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="var(--color-balance)"
          strokeWidth={2}
          dot={false}
        />
        <Scatter
          data={rechargeData}
          dataKey="balance"
          fill="var(--color-recharge)"
          name="Recharge"
        />
      </LineChart>
    </ChartContainer>
  )
}

const monthlyConfig = {
  units: { label: "Units", color: "var(--chart-1)" },
} satisfies ChartConfig

export function MonthlyConsumptionChart({
  months,
}: {
  months: { month: string; units: number }[]
}) {
  return (
    <ChartContainer
      config={monthlyConfig}
      className="aspect-auto h-[240px] w-full"
    >
      <BarChart
        data={months}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) =>
            prettyMonth(value).replace(" 2026", "")
          }
        />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="units" fill="var(--color-units)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const comparisonConfig = {
  low: { label: "Low balance", color: "var(--chart-1)" },
  monthly: { label: "Monthly", color: "var(--chart-2)" },
} satisfies ChartConfig

export function ComparisonCostChart({
  low,
  monthly,
}: {
  low: CostTotals
  monthly: CostTotals
}) {
  const data = [
    {
      category: "Energy",
      low: low.energyPoisha / 100,
      monthly: monthly.energyPoisha / 100,
    },
    {
      category: "VAT",
      low: low.vatPoisha / 100,
      monthly: monthly.vatPoisha / 100,
    },
    {
      category: "Fixed",
      low: low.fixedPoisha / 100,
      monthly: monthly.fixedPoisha / 100,
    },
  ]
  return (
    <ChartContainer
      config={comparisonConfig}
      className="aspect-auto h-[260px] w-full"
    >
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => `৳${value}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {
                      comparisonConfig[name as keyof typeof comparisonConfig]
                        ?.label
                    }
                  </span>
                  <span className="font-mono font-medium">
                    ৳
                    {Number(value).toLocaleString("en-BD", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="low"
          fill="#14b8a6"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="monthly"
          fill="#f59e0b"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
