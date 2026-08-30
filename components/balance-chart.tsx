"use client"

import type { DailyLedgerRow } from "@/src/domain/types"
import { formatBdt } from "@/src/domain/money"

export function BalanceChart({ rows }: { rows: DailyLedgerRow[] }) {
  const width = 1000
  const height = 280
  const inset = { top: 22, right: 24, bottom: 34, left: 72 }
  const values = rows.map((row) => row.closingBalancePoisha)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = Math.max(1, max - min)
  const x = (index: number) => inset.left + (index / Math.max(1, rows.length - 1)) * (width - inset.left - inset.right)
  const y = (value: number) => inset.top + ((max - value) / range) * (height - inset.top - inset.bottom)
  const path = rows.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row.closingBalancePoisha).toFixed(1)}`).join(" ")
  const ticks = [max, Math.round(max - range / 2), min]

  return (
    <div className="w-full overflow-x-auto" aria-label="Daily closing balance chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[700px]" role="img">
        <title>Daily meter balance with recharge markers</title>
        <desc>Closing balance from {rows[0]?.date} to {rows.at(-1)?.date}. Amber dots show recharge days.</desc>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={inset.left} x2={width - inset.right} y1={y(value)} y2={y(value)} className="stroke-border" strokeDasharray="3 8" />
            <text x={inset.left - 10} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[12px]">{formatBdt(value)}</text>
          </g>
        ))}
        {min < 0 && <line x1={inset.left} x2={width - inset.right} y1={y(0)} y2={y(0)} className="stroke-destructive" strokeWidth="1.5" />}
        <path d={path} fill="none" className="stroke-primary" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((row, index) => row.rechargePoisha > 0 && (
          <g key={row.date}>
            <line x1={x(index)} x2={x(index)} y1={inset.top} y2={height - inset.bottom} className="stroke-meter-amber/30" strokeDasharray="2 7" />
            <circle cx={x(index)} cy={y(row.closingBalancePoisha)} r="5" className="fill-meter-amber stroke-background" strokeWidth="2" />
          </g>
        ))}
        <text x={inset.left} y={height - 8} className="fill-muted-foreground font-mono text-[12px]">{rows[0]?.date}</text>
        <text x={width - inset.right} y={height - 8} textAnchor="end" className="fill-muted-foreground font-mono text-[12px]">{rows.at(-1)?.date}</text>
      </svg>
    </div>
  )
}
