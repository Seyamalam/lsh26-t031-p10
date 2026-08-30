"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  ReceiptText,
  Sun,
  Zap,
} from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { calculateRechargeNeed } from "@/src/domain/advice"
import { prettyDate, prettyMonth } from "@/src/domain/dates"
import { formatBdt, parseBdt } from "@/src/domain/money"

export function JudgeShortcuts() {
  const {
    activeCase,
    ledger,
    last,
    monthly,
    runOut,
    comparison,
    alreadyRechargedThisMonth,
  } = useFixture()
  const lateRecharge = activeCase.recharges
    .filter((item) => Number(item.date.slice(8, 10)) >= 24)
    .reduce<(typeof activeCase.recharges)[number] | null>((largest, item) => {
      if (!largest || parseBdt(item.amount_bdt) > parseBdt(largest.amount_bdt))
        return item
      return largest
    }, null)
  const firstFixed = ledger.find((row) => row.fixedChargesPoisha > 0)
  const advice = calculateRechargeNeed(
    {
      date: activeCase.today,
      balancePoisha: last.closingBalancePoisha,
      monthlyUnits: last.monthlyUnitsAfter,
    },
    activeCase.target_date,
    activeCase.usual_daily_units,
    alreadyRechargedThisMonth
  )

  const shortcuts = [
    {
      href: "/dashboard#history-checks",
      label: "Light month",
      value: `${prettyMonth(monthly.light.month)} · ${monthly.light.units} units`,
      icon: Sun,
    },
    {
      href: "/dashboard#history-checks",
      label: "Heavy summer month",
      value: `${prettyMonth(monthly.heavy.month)} · ${monthly.heavy.units} units`,
      icon: Zap,
    },
    {
      href: "/dashboard#history-checks",
      label: "Late large recharge",
      value: lateRecharge
        ? `${prettyDate(lateRecharge.date)} · ${formatBdt(parseBdt(lateRecharge.amount_bdt))}`
        : "No late recharge",
      icon: CalendarClock,
    },
    {
      href: "/ledger#fixed-charge-evidence",
      label: "First recharge charges",
      value: firstFixed
        ? `${prettyDate(firstFixed.date)} · ${formatBdt(firstFixed.fixedChargesPoisha)}`
        : "No fixed charge",
      icon: ReceiptText,
    },
    {
      href: "/advisor#run-out-answer",
      label: "Run-out answer",
      value: runOut ? prettyDate(runOut.date) : "Beyond forecast",
      icon: CalendarClock,
    },
    {
      href: "/advisor#deposit-breakdown",
      label: "Deposit breakdown",
      value: `${formatBdt(advice.rechargeNeededPoisha)} through ${prettyDate(activeCase.target_date)}`,
      icon: FileSearch,
    },
    {
      href: "/comparison#habit-invariant",
      label: "Equal energy and VAT",
      value: comparison.invariant
        ? `${formatBdt(comparison.lowBalance.energyPoisha)} + ${formatBdt(comparison.lowBalance.vatPoisha)}`
        : "Invariant failed",
      icon: CheckCircle2,
    },
  ]

  return (
    <Card className="border-primary/25 bg-primary/[0.025]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Judge shortcuts</CardTitle>
        <CardDescription>
          Open the exact evidence for each tariff requirement.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            prefetch
            className="group flex min-h-20 items-start gap-3 rounded-lg border bg-background/80 p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <item.icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-medium">
                {item.label}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
              <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                {item.value}
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
