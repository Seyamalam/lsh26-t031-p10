"use client"

import {
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ReceiptText,
  Search,
} from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadTextFile } from "@/lib/download"
import { ledgerCsv } from "@/src/domain/export"
import { formatBdt } from "@/src/domain/money"
import type { DailyLedgerRow } from "@/src/domain/types"

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

const helper = createColumnHelper<typeof features, DailyLedgerRow>()
const columns = helper.columns([
  helper.accessor("date", { header: "Date" }),
  helper.accessor("openingBalancePoisha", {
    header: "Opening",
    cell: ({ getValue }) => formatBdt(getValue()),
  }),
  helper.accessor("units", {
    header: "Units",
    cell: ({ getValue }) => getValue().toFixed(2),
  }),
  helper.accessor("monthlyUnitsAfter", {
    header: "Month total",
    cell: ({ getValue }) => `${getValue().toFixed(2)} kWh`,
  }),
  helper.accessor("slabAllocations", {
    header: "Slab allocation",
    cell: ({ getValue }) => (
      <span className="block min-w-48 font-sans text-[11px] leading-4 whitespace-normal text-muted-foreground">
        {getValue()
          .map(
            (item) =>
              `${item.label}: ${item.units}u at ${(item.ratePoisha / 100).toFixed(2)}`
          )
          .join(" · ") || "No units"}
      </span>
    ),
  }),
  helper.accessor("rechargePoisha", {
    header: "Recharge",
    cell: ({ getValue }) =>
      getValue() > 0 ? (
        <span className="font-medium text-teal-700 dark:text-teal-300">
          +{formatBdt(getValue())}
        </span>
      ) : (
        "—"
      ),
  }),
  helper.accessor("fixedChargesPoisha", {
    header: "Fixed",
    cell: ({ getValue }) => (getValue() > 0 ? formatBdt(getValue()) : "—"),
  }),
  helper.accessor("energyCostPoisha", {
    header: "Energy",
    cell: ({ getValue }) => formatBdt(getValue()),
  }),
  helper.accessor("vatPoisha", {
    header: "VAT",
    cell: ({ getValue }) => formatBdt(getValue()),
  }),
  helper.accessor("closingBalancePoisha", {
    header: "Closing",
    cell: ({ getValue }) => (
      <span
        className={
          getValue() < 0 ? "font-semibold text-destructive" : "font-semibold"
        }
      >
        {formatBdt(getValue())}
      </span>
    ),
  }),
])

export function LedgerTable() {
  const { activeCase, ledger } = useFixture()
  const table = useTable({
    features,
    columns,
    data: ledger,
    initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const firstFixed = ledger.find((row) => row.fixedChargesPoisha > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Daily ledger
            </h1>
            <Badge variant="outline" className="font-mono text-[10px]">
              {activeCase.case_id}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every reading, charge and recharge in meter order.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Filter ledger rows"
              className="pl-8"
              placeholder="Filter by date or value"
              value={(table.state.globalFilter as string) ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() =>
              downloadTextFile(
                `${activeCase.case_id}-daily-ledger.csv`,
                ledgerCsv(activeCase.case_id, ledger)
              )
            }
          >
            <Download aria-hidden="true" /> Export full CSV
          </Button>
        </div>
      </div>

      <Card
        id="fixed-charge-evidence"
        className="scroll-mt-20 border-primary/25 bg-primary/[0.025]"
        size="sm"
      >
        <CardHeader>
          <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <ReceiptText aria-hidden="true" className="size-4" />
          </div>
          <CardDescription>First recharge fixed charges</CardDescription>
          <CardTitle className="font-mono text-lg">
            BDT 42 demand + BDT 40 rent = BDT 82
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="font-mono">
              {firstFixed?.date ?? "No charged recharge"}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm">Reconstructed balance</CardTitle>
              <CardDescription>
                {filteredCount} of {ledger.length} days
              </CardDescription>
            </div>
            <Badge variant="secondary">
              First recharge carries monthly fixed charges
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2 text-xs"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <ArrowUpDown
                            aria-hidden="true"
                            className="ml-1 size-3"
                          />
                        </Button>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.original.rechargePoisha > 0
                        ? "bg-teal-50/50 dark:bg-teal-950/20"
                        : undefined
                    }
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="font-mono text-xs tabular-nums"
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-28 text-center text-muted-foreground"
                  >
                    No ledger rows match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {Math.max(table.getPageCount(), 1)}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft aria-hidden="true" className="size-4" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
