"use client"

import { useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowDown, CalendarClock, CheckCircle2, CircleGauge, RefreshCcw, Upload, Zap } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BalanceChart } from "@/components/balance-chart"
import { calculateRechargeNeed, forecastRunOut } from "@/src/domain/advice"
import { compareHabits } from "@/src/domain/comparison"
import { prettyDate, prettyMonth } from "@/src/domain/dates"
import { runDailyLedger } from "@/src/domain/ledger"
import { formatBdt, parseBdt } from "@/src/domain/money"
import { summarizeMonths } from "@/src/domain/summary"
import type { FixtureDocument } from "@/src/domain/types"
import { validateFixture } from "@/src/data/fixture"

export default function MeterAdvisor({ publishedFixture }: { publishedFixture: FixtureDocument }) {
  const [fixture, setFixture] = useState(() => validateFixture(publishedFixture))
  const [caseId, setCaseId] = useState(fixture.cases[0].case_id)
  const [targetDate, setTargetDate] = useState(fixture.cases[0].target_date)
  const [uploadError, setUploadError] = useState("")
  const [ledgerFilter, setLedgerFilter] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const activeCase = fixture.cases.find((item) => item.case_id === caseId) ?? fixture.cases[0]
  const ledger = useMemo(() => runDailyLedger(parseBdt(activeCase.opening_balance_bdt), activeCase.days, activeCase.recharges), [activeCase])
  const last = ledger.at(-1)!
  const projectionState = { date: activeCase.today, balancePoisha: last.closingBalancePoisha, monthlyUnits: last.monthlyUnitsAfter }
  const runOut = forecastRunOut(projectionState, activeCase.usual_daily_units)
  const alreadyRecharged = activeCase.recharges.some((recharge) => recharge.date.startsWith(activeCase.today.slice(0, 7)))
  const advice = calculateRechargeNeed(projectionState, targetDate, activeCase.usual_daily_units, alreadyRecharged)
  const comparison = useMemo(() => compareHabits(activeCase.days, activeCase.comparison), [activeCase])
  const monthly = useMemo(() => summarizeMonths(activeCase), [activeCase])
  const filteredLedger = ledger.filter((row) => !ledgerFilter || row.date.includes(ledgerFilter))
  const dialPosition = Math.max(-120, Math.min(120, (last.closingBalancePoisha / 500_000) * 120))

  const chooseCase = (nextId: string | null) => {
    if (!nextId) return
    const next = fixture.cases.find((item) => item.case_id === nextId)
    if (!next) return
    setCaseId(nextId)
    setTargetDate(next.target_date)
    setLedgerFilter("")
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = validateFixture(JSON.parse(await file.text()))
      setFixture(next)
      setCaseId(next.cases[0].case_id)
      setTargetDate(next.cases[0].target_date)
      setUploadError("")
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The JSON file could not be loaded.")
    } finally {
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const reset = () => {
    const next = validateFixture(publishedFixture)
    setFixture(next)
    setCaseId(next.cases[0].case_id)
    setTargetDate(next.cases[0].target_date)
    setUploadError("")
  }

  return (
    <main id="main" className="min-h-svh bg-background text-foreground">
      <a href="#analysis" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to analysis</a>
      <header className="border-b border-border/70 bg-meter-deep text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full border border-meter-mint/40 bg-meter-mint/10"><CircleGauge className="size-5 text-meter-mint" /></div>
            <div><p className="font-heading text-xl font-semibold tracking-tight">Meterwise</p><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">P10 · prepaid control desk</p></div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5"><Label className="text-xs text-white/65">Fixture case</Label><Select value={caseId} onValueChange={chooseCase}><SelectTrigger className="w-40 border-white/15 bg-white/8 text-white"><SelectValue /></SelectTrigger><SelectContent>{fixture.cases.map((item) => <SelectItem key={item.case_id} value={item.case_id}>{item.case_id}</SelectItem>)}</SelectContent></Select></div>
            <Input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => loadFile(event.target.files?.[0])} aria-label="Upload a P10 fixture JSON file" />
            <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => fileInput.current?.click()}><Upload /> Load JSON</Button>
            <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={reset}><RefreshCcw /> Reset sample</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {uploadError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Fixture rejected</AlertTitle><AlertDescription>{uploadError} Fix the named field and try again.</AlertDescription></Alert>}
        <section id="analysis" className="grid overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative flex min-h-[400px] flex-col justify-between overflow-hidden bg-meter-deep p-6 text-white sm:p-10">
            <div className="absolute -right-28 -bottom-40 size-[34rem] rounded-full border-[70px] border-meter-mint/5" aria-hidden="true" />
            <div className="relative z-10 max-w-2xl"><Badge className="mb-5 border-meter-mint/30 bg-meter-mint/10 text-meter-mint">Live reconstructed balance</Badge><h1 className="font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Every taka has<br />a trail.</h1><p className="mt-5 max-w-xl text-base leading-7 text-white/65">Daily readings become an auditable meter balance. Recharge timing never resets the slab counter—and never invents a saving.</p></div>
            <div className="relative z-10 mt-10 flex flex-wrap items-end gap-x-10 gap-y-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Balance after {prettyDate(activeCase.today)}</p><p className={`mt-2 font-mono text-4xl font-medium ${last.closingBalancePoisha < 0 ? "text-meter-coral" : "text-meter-mint"}`}>{formatBdt(last.closingBalancePoisha)}</p></div><div className="pb-1"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Usual draw</p><p className="mt-2 font-mono text-xl">{activeCase.usual_daily_units} units/day</p></div></div>
          </div>
          <div className="flex flex-col justify-between p-6 sm:p-10">
            <div className="meter-dial mx-auto grid size-64 place-items-center rounded-full border-[18px] border-muted bg-background shadow-inner sm:size-72"><div className="relative grid size-[78%] place-items-center rounded-full bg-card shadow-[0_0_0_8px_var(--background)]"><span className="absolute top-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">balance dial</span><div className="absolute bottom-1/2 left-1/2 h-1 w-[38%] origin-left rounded-full bg-foreground transition-transform duration-700 motion-reduce:transition-none" style={{ transform: `rotate(${dialPosition - 90}deg)` }}><span className="absolute -right-1 -top-1 size-3 rounded-full bg-foreground" /></div><div className="absolute bottom-[24%] text-center"><p className="font-mono text-xl font-semibold">{formatBdt(last.closingBalancePoisha)}</p><p className="mt-1 text-xs text-muted-foreground">closing balance</p></div></div></div>
            <div className="mt-7 border-t pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Projected run-out</p><div className="mt-2 flex items-baseline justify-between gap-4"><p className="font-heading text-2xl font-semibold">{runOut ? prettyDate(runOut.date) : "Beyond 10 years"}</p><Badge variant="outline">{runOut?.days ?? "3,650+"} days</Badge></div><p className="mt-2 text-sm text-muted-foreground">First day the projected closing balance is zero or below.</p></div>
          </div>
        </section>

        <section aria-labelledby="history-title" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">Reading history</p><h2 id="history-title" className="section-title">Six-month signal map</h2></div><p className="text-sm text-muted-foreground">{activeCase.days.length} consecutive readings · {activeCase.recharges.length} recharge events</p></div>
          <div className="grid gap-3 md:grid-cols-3"><SignalCard label="Light month" month={monthly.light.month} value={`${monthly.light.units} units`} note="Lowest consumption" tone="mint" /><SignalCard label="Heavy summer" month={monthly.heavy.month} value={`${monthly.heavy.units} units`} note="Highest consumption" tone="coral" /><SignalCard label="Late large recharge" month={monthly.late?.month ?? monthly.months.at(-1)!.month} value={monthly.late ? formatBdt(monthly.late.lateRechargePoisha) : "None"} note="Deposited in final week" tone="amber" /></div>
          <Card><CardHeader><CardTitle>Monthly consumption profile</CardTitle><CardDescription>Monthly slab counters reset at each calendar month—not when money is added.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{monthly.months.map((item) => { const maxUnits = Math.max(...monthly.months.map((month) => month.units)); return <div key={item.month} className="rounded-lg bg-muted/50 p-3"><div className="flex h-24 items-end"><div className="w-full rounded-sm bg-primary/80" style={{ height: `${Math.max(8, (item.units / maxUnits) * 100)}%` }} /></div><p className="mt-3 font-mono text-xs">{prettyMonth(item.month)}</p><p className="mt-1 text-sm font-semibold">{item.units} units</p></div> })}</div></CardContent></Card>
        </section>

        <section aria-labelledby="ledger-title" className="space-y-4">
          <div><p className="section-kicker">Daily reconstruction</p><h2 id="ledger-title" className="section-title">Balance trace</h2></div>
          <Card><CardHeader><CardTitle>Closing balance over time</CardTitle><CardDescription>Recharge markers are amber. Negative balances remain visible below the zero line.</CardDescription><CardAction><Badge variant="outline"><Zap /> {activeCase.recharges.length} recharges</Badge></CardAction></CardHeader><CardContent><BalanceChart rows={ledger} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Inspect any day</CardTitle><CardDescription>Opening balance → start-of-day recharge and first monthly fixed charge → energy and VAT → closing balance.</CardDescription><CardAction><Input className="w-36 font-mono" type="month" value={ledgerFilter} onChange={(event) => setLedgerFilter(event.target.value)} aria-label="Filter ledger by month" /></CardAction></CardHeader><CardContent className="px-0"><ScrollArea className="h-[480px]"><Table><TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="pl-4">Date</TableHead><TableHead className="text-right">Open</TableHead><TableHead className="text-right">Recharge</TableHead><TableHead className="text-right">Fixed</TableHead><TableHead className="text-right">Units / MTD</TableHead><TableHead>Slab trace</TableHead><TableHead className="text-right">Energy + VAT</TableHead><TableHead className="pr-4 text-right">Close</TableHead></TableRow></TableHeader><TableBody>{filteredLedger.map((row) => <TableRow key={row.date} className={row.rechargePoisha ? "bg-meter-amber/5" : ""}><TableCell className="pl-4 font-mono text-xs">{row.date}</TableCell><TableCell className="text-right font-mono text-xs">{formatBdt(row.openingBalancePoisha)}</TableCell><TableCell className="text-right font-mono text-xs">{row.rechargePoisha ? formatBdt(row.rechargePoisha) : "—"}</TableCell><TableCell className="text-right font-mono text-xs">{row.fixedChargesPoisha ? formatBdt(row.fixedChargesPoisha) : "—"}</TableCell><TableCell className="text-right font-mono text-xs">{row.units} / {row.monthlyUnitsAfter}</TableCell><TableCell><div className="flex min-w-44 flex-wrap gap-1">{row.slabAllocations.map((part) => <Badge key={`${part.label}-${part.units}`} variant="outline" className="font-mono text-[10px]">{part.units}u × {(part.ratePoisha / 100).toFixed(2)}</Badge>)}</div></TableCell><TableCell className="text-right font-mono text-xs">{formatBdt(row.energyCostPoisha)} + {formatBdt(row.vatPoisha)}</TableCell><TableCell className={`pr-4 text-right font-mono text-xs font-semibold ${row.closingBalancePoisha < 0 ? "text-destructive" : ""}`}>{formatBdt(row.closingBalancePoisha)}</TableCell></TableRow>)}</TableBody></Table></ScrollArea></CardContent></Card>
        </section>

        <section aria-labelledby="advice-title" className="space-y-4">
          <div><p className="section-kicker">Household advice</p><h2 id="advice-title" className="section-title">How long—and how much?</h2></div>
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="bg-meter-deep text-white ring-0"><CardHeader><CardTitle className="text-white">Run-out forecast</CardTitle><CardDescription className="text-white/55">At {activeCase.usual_daily_units} usual units each day</CardDescription><CardAction><CalendarClock className="size-5 text-meter-mint" /></CardAction></CardHeader><CardContent><p className="font-heading text-4xl font-semibold">{runOut ? prettyDate(runOut.date) : "Beyond horizon"}</p><p className="mt-3 text-white/60">The calendar-month slab counter continues from {last.monthlyUnitsAfter} units, then resets on the first of the next month.</p></CardContent><CardFooter className="border-white/10 bg-white/5 text-white/65">{runOut?.days === 0 ? "The balance is already zero or below." : `${runOut?.days} projected usage days remain.`}</CardFooter></Card>
            <Card><CardHeader><CardTitle>Recharge needed today</CardTitle><CardDescription>Choose a target date. The amount reconciles to the poisha.</CardDescription><CardAction><div className="grid gap-1"><Label htmlFor="target" className="text-xs">Last through</Label><Input id="target" type="date" min={incrementDate(activeCase.today)} value={targetDate} onChange={(event) => event.target.value > activeCase.today && setTargetDate(event.target.value)} /></div></CardAction></CardHeader><CardContent><div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Advised deposit</p><p className="mt-2 font-mono text-4xl font-semibold text-primary">{formatBdt(advice.rechargeNeededPoisha)}</p><p className="mt-2 text-sm text-muted-foreground">Covers {advice.projectedDays} days · {advice.projectedUnits} projected units</p></div><div className="space-y-2 text-sm"><Breakdown label="Energy at first-slab rate" value={advice.baselineEnergyPoisha} /><Breakdown label="Higher-slab increment" value={advice.higherSlabPoisha} /><Breakdown label="VAT on energy only" value={advice.vatPoisha} /><Breakdown label="Applicable fixed charges" value={advice.fixedPoisha} /><Separator /><Breakdown label="Current balance offset" value={-advice.balanceCreditPoisha} muted /><Breakdown label="Recharge required" value={advice.rechargeNeededPoisha} strong /></div></div></CardContent><CardFooter className="text-muted-foreground"><CheckCircle2 className="mr-2 size-4 text-meter-mint" /> Fixed charges appear only if this would be the month&apos;s first recharge.</CardFooter></Card>
          </div>
        </section>

        <section aria-labelledby="comparison-title" className="space-y-4 pb-10">
          <div><p className="section-kicker">Three-month experiment</p><h2 id="comparison-title" className="section-title">Same units. Same energy cost.</h2></div>
          <Card><CardHeader><CardTitle>Recharge habit comparison</CardTitle><CardDescription>{activeCase.comparison.months.map(prettyMonth).join(" · ")} · {comparison.days} identical daily readings</CardDescription><CardAction><Badge className="bg-meter-mint/15 text-meter-mint"><CheckCircle2 /> invariant passed</Badge></CardAction></CardHeader><CardContent><Tabs defaultValue="cost"><TabsList variant="line"><TabsTrigger value="cost">Consumed cost</TabsTrigger><TabsTrigger value="cash">Deposits & balance</TabsTrigger></TabsList><TabsContent value="cost" className="pt-5"><div className="grid gap-4 lg:grid-cols-2"><HabitCard name="Low-balance habit" detail={`Add ${activeCase.comparison.low_amount_bdt} BDT below ${activeCase.comparison.low_threshold_bdt} BDT`} values={comparison.lowBalance} /><HabitCard name="Monthly habit" detail={`Add ${activeCase.comparison.monthly_amount_bdt} BDT on each 1st`} values={comparison.monthly} /></div><Alert className="mt-4 border-meter-mint/25 bg-meter-mint/5"><CheckCircle2 className="text-meter-mint" /><AlertTitle>Energy and VAT are exactly equal</AlertTitle><AlertDescription>{comparison.cheaper === "equal" ? "Both habits consume the same total cost." : `${comparison.cheaper === "low" ? "Low-balance" : "Monthly"} costs ${formatBdt(comparison.differencePoisha)} less solely because of monthly first-recharge fixed charges.`} Recharge timing never changes a slab rate.</AlertDescription></Alert></TabsContent><TabsContent value="cash" className="pt-5"><div className="grid gap-4 sm:grid-cols-2"><CashCard name="Low-balance habit" deposits={comparison.lowBalance.depositsPoisha} end={comparison.lowBalance.endingBalancePoisha} count={comparison.lowBalance.rechargeCount} /><CashCard name="Monthly habit" deposits={comparison.monthly.depositsPoisha} end={comparison.monthly.endingBalancePoisha} count={comparison.monthly.rechargeCount} /></div><p className="mt-4 text-sm text-muted-foreground">Deposits are cash added, not cost. Ending balance = opening balance + deposits − consumed cost.</p></TabsContent></Tabs></CardContent></Card>
        </section>
      </div>
      <footer className="border-t px-4 py-6 text-center font-mono text-xs text-muted-foreground">LSH26-T031 · P10 · all money calculated in integer poisha</footer>
    </main>
  )
}

function incrementDate(date: string) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10) }

function SignalCard({ label, month, value, note, tone }: { label: string; month: string; value: string; note: string; tone: "mint" | "coral" | "amber" }) {
  const tones = { mint: "bg-meter-mint", coral: "bg-meter-coral", amber: "bg-meter-amber" }
  return <Card size="sm"><CardHeader><div className={`mb-2 h-1 w-12 rounded-full ${tones[tone]}`} /><CardDescription>{label}</CardDescription><CardTitle className="text-lg">{prettyMonth(month)}</CardTitle><CardAction><Badge variant="outline">{value}</Badge></CardAction></CardHeader><CardContent className="text-xs text-muted-foreground">{note}</CardContent></Card>
}

function Breakdown({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 ${muted ? "text-muted-foreground" : ""} ${strong ? "font-semibold" : ""}`}><span>{label}</span><span className="font-mono">{value < 0 ? `−${formatBdt(Math.abs(value))}` : formatBdt(value)}</span></div>
}

function HabitCard({ name, detail, values }: { name: string; detail: string; values: ReturnType<typeof compareHabits>["lowBalance"] }) {
  return <div className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-heading font-semibold">{name}</h3><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><p className="font-mono text-lg font-semibold">{formatBdt(values.costPoisha)}</p></div><Separator className="my-4" /><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Energy" value={values.energyPoisha} /><Metric label="VAT" value={values.vatPoisha} /><Metric label="Fixed" value={values.fixedPoisha} /></div></div>
}

function Metric({ label, value }: { label: string; value: number }) { return <div><p className="font-mono text-sm font-semibold">{formatBdt(value)}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p></div> }

function CashCard({ name, deposits, end, count }: { name: string; deposits: number; end: number; count: number }) { return <div className="rounded-xl bg-muted/50 p-5"><p className="font-heading font-semibold">{name}</p><div className="mt-4 flex items-center gap-3"><div><p className="font-mono text-xl font-semibold">{formatBdt(deposits)}</p><p className="text-xs text-muted-foreground">{count} deposits</p></div><ArrowDown className="ml-auto size-4 text-muted-foreground" /><div className="text-right"><p className="font-mono text-xl font-semibold">{formatBdt(end)}</p><p className="text-xs text-muted-foreground">ending balance</p></div></div></div> }
