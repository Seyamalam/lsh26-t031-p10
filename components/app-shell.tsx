"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BellRing,
  Calculator,
  ChartNoAxesCombined,
  Database,
  LayoutDashboard,
  PlugZap,
  RefreshCcw,
  Table2,
} from "lucide-react"

import { FixtureUpload } from "@/components/fixture-upload"
import { ThemeToggle } from "@/components/theme-toggle"
import { useFixture } from "@/components/fixture-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ledger", label: "Daily ledger", icon: Table2 },
  { href: "/advisor", label: "Recharge advisor", icon: Calculator },
  { href: "/comparison", label: "Habit comparison", icon: BarChart3 },
  { href: "/forecast", label: "Demand forecast", icon: ChartNoAxesCombined },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/simulator", label: "Appliance simulator", icon: PlugZap },
  { href: "/datasets", label: "Datasets", icon: Database },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ledger": "Daily ledger",
  "/advisor": "Recharge advisor",
  "/comparison": "Habit comparison",
  "/forecast": "Demand forecast",
  "/alerts": "Alerts",
  "/simulator": "Appliance simulator",
  "/datasets": "Datasets",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const {
    fixture,
    fixtureRevision,
    caseId,
    datasetId,
    datasetName,
    datasetKind,
    savedDatasets,
    selectDataset,
    selectCase,
    resetFixture,
    uploadError,
    workspaceError,
    clearUploadError,
  } = useFixture()

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="h-[var(--shell-header-height)] shrink-0 border-b border-[var(--shell-divider-color)] p-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <Image
              src="/brand-mark.png"
              alt=""
              width={32}
              height={32}
              priority
              className="size-8 shrink-0 object-contain"
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">Meterwise</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                LSH26-T031 · P10
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} prefetch />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-[var(--shell-header-height)] shrink-0 items-center gap-2 border-b border-[var(--shell-divider-color)] bg-background/95 px-3 backdrop-blur sm:px-5">
          <SidebarTrigger />
          <div className="h-5 w-px bg-border" />
          <span className="mr-auto text-sm font-semibold">
            {pageTitles[pathname] ?? "Meterwise"}
          </span>
          <div className="hidden items-center gap-2 sm:flex">
            <DatasetSelect
              datasetId={datasetId}
              datasetName={datasetName}
              datasetKind={datasetKind}
              savedDatasets={savedDatasets}
              selectDataset={selectDataset}
            />
            <Select value={caseId} onValueChange={selectCase}>
              <SelectTrigger
                size="sm"
                className="w-28 font-mono"
                aria-label="Fixture case"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fixture.cases.map((item) => (
                  <SelectItem key={item.case_id} value={item.case_id}>
                    {item.case_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Reset published fixture"
              aria-label="Reset published fixture"
              onClick={resetFixture}
            >
              <RefreshCcw />
            </Button>
          </div>
          <FixtureUpload />
          <ThemeToggle />
        </header>

        <div className="flex items-center gap-2 border-b px-3 py-2 sm:hidden">
          <DatasetSelect
            datasetId={datasetId}
            datasetName={datasetName}
            datasetKind={datasetKind}
            savedDatasets={savedDatasets}
            selectDataset={selectDataset}
            compact
          />
          <Select value={caseId} onValueChange={selectCase}>
            <SelectTrigger
              size="sm"
              className="min-w-0 flex-1 font-mono"
              aria-label="Fixture case"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fixture.cases.map((item) => (
                <SelectItem key={item.case_id} value={item.case_id}>
                  {item.case_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reset published fixture"
            onClick={resetFixture}
          >
            <RefreshCcw />
          </Button>
        </div>

        {uploadError && (
          <div className="px-3 pt-3 sm:px-5">
            <Alert variant="destructive">
              <AlertTitle>Fixture rejected</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{uploadError}</span>
                <Button variant="ghost" size="sm" onClick={clearUploadError}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {workspaceError && !uploadError && (
          <div className="px-3 pt-3 sm:px-5">
            <Alert variant="destructive">
              <AlertTitle>Device workspace unavailable</AlertTitle>
              <AlertDescription>{workspaceError}</AlertDescription>
            </Alert>
          </div>
        )}

        <main
          key={fixtureRevision}
          id="main-content"
          className="flex-1 p-3 sm:p-5 lg:p-6"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DatasetSelect({
  datasetId,
  datasetName,
  datasetKind,
  savedDatasets,
  selectDataset,
  compact = false,
}: {
  datasetId: string
  datasetName: string
  datasetKind: "bundled" | "saved" | "temporary"
  savedDatasets: { id: string; name: string }[]
  selectDataset: (id: string | null) => Promise<void>
  compact?: boolean
}) {
  return (
    <Select
      value={datasetId}
      onValueChange={(value) => void selectDataset(value)}
    >
      <SelectTrigger
        size="sm"
        className={compact ? "min-w-0 flex-1" : "w-44"}
        aria-label="Dataset"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Bundled / session</SelectLabel>
          <SelectItem value="bundled:p10-public">
            Bundled public fixture
          </SelectItem>
          {datasetKind === "temporary" && (
            <SelectItem value={datasetId}>{datasetName}</SelectItem>
          )}
        </SelectGroup>
        {savedDatasets.length > 0 && (
          <SelectGroup>
            <SelectLabel>Saved on this device</SelectLabel>
            {savedDatasets.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
